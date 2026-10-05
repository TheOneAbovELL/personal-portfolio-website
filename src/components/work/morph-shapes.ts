import { lerp, smoothstep } from "@/lib/motion";
import { illustrativeSeries } from "@/lib/quant";

/**
 * Geometry for the transitions between programmes (DATA_MORPH, docs/RACE-SYSTEM.md §8).
 *
 * A transition is one set of lines that passes through three named states. Every state is a
 * pure function of the line index and a position along the line, so the same lines can be
 * interpolated point for point: text becomes a retrieval graph becomes signal traces, and so
 * on. Nothing here is random at run time — the "noise" is hashed from the line index, so a
 * line has the same shape on every frame, every visit and every build.
 */

export type MorphKind = "information-signal" | "waveform-chart" | "chart-grid";

/** One state of the line set. Points are normalised to the band: x and y run 0 → 1. */
export interface MorphShape {
  /** lines × samples × (x, y). */
  points: Float32Array;
  /** Opacity per line. */
  alpha: Float32Array;
  /** Per line: 0 draws in the programme's primary colour, 1 in its secondary. */
  tone: Float32Array;
  /** 1 breaks each line into word-length dashes (text); 0 draws it solid. */
  words: number;
  /** Opacity of the junction dots where lines meet (a retrieval graph's nodes). */
  nodes: number;
}

export interface MorphGeometry {
  lines: number;
  /** Samples per line. (samples − 1) must divide by 3 so junctions land on a sample. */
  samples: number;
  /** Width over height of the drawing area — the grid uses it to keep its cells square. */
  aspect: number;
  /** Scales waveform frequency so narrow bands are not asked to draw more cycles than fit. */
  detail: number;
}

type ShapeBuilder = (geometry: MorphGeometry) => MorphShape;

export interface MorphSpec {
  /** Names of the three states, shown on the transition's rail. */
  states: readonly [string, string, string];
  build: readonly [ShapeBuilder, ShapeBuilder, ShapeBuilder];
}

/** Positions along a line (0 → 1) where the retrieval graph's layers sit. */
export const NODE_STOPS = [0, 1 / 3, 2 / 3, 1] as const;

const TAU = Math.PI * 2;

/** Stable pseudo-random value in [0, 1) for a line index. */
const hash = (n: number) => {
  const s = Math.sin(n * 127.1 + 311.7) * 43758.5453;
  return s - Math.floor(s);
};

const WORDS_PER_LINE = 7;

/** Word lengths in pixels for a line of text — the dash pattern that makes a rule read as writing. */
export const wordLengths = (line: number): number[] =>
  Array.from({ length: WORDS_PER_LINE }, (_, word) => 12 + 38 * hash(line * 13 + word * 5 + 2));

interface LineStyle {
  alpha: (line: number) => number;
  tone?: (line: number) => number;
  words?: number;
  nodes?: number;
}

function shape(
  { lines, samples }: MorphGeometry,
  at: (line: number, u: number) => readonly [number, number],
  style: LineStyle,
): MorphShape {
  const points = new Float32Array(lines * samples * 2);
  const alpha = new Float32Array(lines);
  const tone = new Float32Array(lines);
  for (let line = 0; line < lines; line++) {
    alpha[line] = style.alpha(line);
    tone[line] = style.tone?.(line) ?? 0;
    for (let k = 0; k < samples; k++) {
      const [x, y] = at(line, k / (samples - 1));
      const offset = (line * samples + k) * 2;
      points[offset] = x;
      points[offset + 1] = y;
    }
  }
  return { points, alpha, tone, words: style.words ?? 0, nodes: style.nodes ?? 0 };
}

/* --------------------------------------------------------------------------------------------
   Information: a column of statute text, then the retrieval graph it is read into.
   -------------------------------------------------------------------------------------------- */

const PARAGRAPH = 5;
/** The one line carried in the secondary colour: the provision that ends up cited. */
const CITED = PARAGRAPH + 1;

const text: ShapeBuilder = (g) => {
  const last = g.lines - 1;
  const rows = last + Math.floor(last / PARAGRAPH) * 0.8;
  return shape(
    g,
    (line, u) => {
      const opens = line % PARAGRAPH === 0;
      const closes = line % PARAGRAPH === PARAGRAPH - 1 || line === last;
      const start = 0.17 + (opens ? 0.035 : 0);
      const width = closes ? 0.24 + 0.2 * hash(line + 3) : 0.6 + 0.06 * hash(line);
      const row = line + Math.floor(line / PARAGRAPH) * 0.8;
      return [start + width * u, lerp(0.08, 0.92, row / rows)];
    },
    { alpha: (line) => (line === CITED ? 0.95 : 0.6), tone: (line) => (line === CITED ? 1 : 0), words: 1 },
  );
};

/** Many sources → a handful of candidates → two fused lists → one answer. */
const retrieval: ShapeBuilder = (g) => {
  const last = g.lines - 1;
  const layerX = [0.14, 0.41, 0.66, 0.86];
  return shape(
    g,
    (line, u) => {
      const layerY = [
        lerp(0.06, 0.94, line / last),
        lerp(0.2, 0.8, Math.floor((line * 5) / g.lines) / 4),
        line < g.lines / 2 ? 0.37 : 0.63,
        0.5,
      ];
      const span = Math.min(2, Math.floor(u * 3));
      const f = u * 3 - span;
      return [lerp(layerX[span], layerX[span + 1], f), lerp(layerY[span], layerY[span + 1], smoothstep(0.1, 0.9, f))];
    },
    { alpha: (line) => (line === CITED ? 0.95 : 0.5), tone: (line) => (line === CITED ? 1 : 0), nodes: 1 },
  );
};

/* --------------------------------------------------------------------------------------------
   Signal: stacked channel traces, then the same channels as spectra.
   Schematic shapes built from sines — they depict a kind of signal, not a recording.
   -------------------------------------------------------------------------------------------- */

/**
 * A schematic channel trace, roughly −1 → 1, for position `u` (0 → 1) along channel `line`.
 * Shared with the montage figure so the traces that arrive in the transition are the ones
 * the figure shows.
 */
export function waveform(line: number, u: number, detail: number): number {
  const a = hash(line * 7.3 + 1);
  const b = hash(line * 3.1 + 9);
  // A slow envelope gathers the fast rhythm into bursts, which is what makes it read as EEG.
  const burst = 0.5 + 0.5 * Math.sin(TAU * (1.7 * u + a));
  const fast = Math.sin(TAU * ((17 + 5 * a) * detail * u + b));
  const faster = Math.sin(TAU * ((37 + 9 * b) * detail * u + a * 5));
  const slow = Math.sin(TAU * ((5 + 3 * b) * detail * u + a * 3));
  return burst * (0.5 * fast + 0.22 * faster) + 0.28 * slow;
}

const traces: ShapeBuilder = (g) => {
  const last = g.lines - 1;
  const pitch = 0.8 / last;
  return shape(
    g,
    (line, u) => [u, lerp(0.1, 0.9, line / last) + 0.55 * pitch * waveform(line, u, g.detail)],
    { alpha: (line) => (line % 4 === 1 ? 0.85 : 0.55), tone: (line) => (line % 4 === 1 ? 1 : 0) },
  );
};

/** A ridge of spectra: power falling away with frequency, one resonant peak per channel. */
const spectra: ShapeBuilder = (g) => {
  const last = g.lines - 1;
  return shape(
    g,
    (line, u) => {
      const depth = line / last;
      const centre = 0.27 + 0.04 * (hash(line + 11) - 0.5);
      const peak = (0.45 + 0.55 * Math.sin(Math.PI * depth)) * Math.exp(-(((u - centre) / 0.045) ** 2));
      const harmonic = 0.16 * Math.exp(-(((u - centre * 2) / 0.06) ** 2));
      const falloff = 0.55 * Math.exp(-u * 6);
      return [lerp(0.1, 0.9, u), lerp(0.36, 0.94, depth) - 0.3 * (falloff + peak + harmonic)];
    },
    { alpha: (line) => 0.4 + 0.45 * (line / last), tone: (line) => line / last },
  );
};

/* --------------------------------------------------------------------------------------------
   Market: the illustrative series of the ARGUS figure, with the lines that are not series
   becoming the chart's rules; then everything levels out and squares up into a grid.
   -------------------------------------------------------------------------------------------- */

function movingAverage(values: number[], window: number): number[] {
  let sum = 0;
  return values.map((value, index) => {
    sum += value - (index >= window ? values[index - window] : 0);
    return sum / Math.min(index + 1, window);
  });
}

const chart: ShapeBuilder = (g) => {
  // The same generated series the ARGUS figure plots, so the transition resolves into it.
  const { asset, benchmark } = illustrativeSeries();
  const peak: number[] = [];
  for (const value of asset) peak.push(Math.max(value, peak[peak.length - 1] ?? value));
  const series = [
    { values: peak, alpha: 0.38, tone: 0 },
    { values: asset, alpha: 1, tone: 0 },
    { values: movingAverage(asset, 20), alpha: 0.5, tone: 0 },
    { values: movingAverage(asset, 60), alpha: 0.4, tone: 0.5 },
    { values: benchmark, alpha: 0.75, tone: 1 },
  ];
  const all = [...asset, ...benchmark];
  const min = Math.min(...all);
  const max = Math.max(...all);

  // Series take evenly spread lines; the lines between them flatten into rules.
  const seriesOf = new Map(series.map((item, k) => [Math.floor(((k + 0.5) * g.lines) / series.length), item]));
  const ruleOf = new Map<number, number>();
  for (let line = 0; line < g.lines; line++) if (!seriesOf.has(line)) ruleOf.set(line, ruleOf.size);
  const rules = Math.max(1, ruleOf.size - 1);

  return shape(
    g,
    (line, u) => {
      const x = lerp(0.07, 0.93, u);
      const item = seriesOf.get(line);
      if (!item) return [x, lerp(0.12, 0.88, (ruleOf.get(line) ?? 0) / rules)];
      const position = u * (item.values.length - 1);
      const index = Math.min(item.values.length - 2, Math.floor(position));
      const value = lerp(item.values[index], item.values[index + 1], position - index);
      return [x, 0.86 - 0.72 * ((value - min) / (max - min))];
    },
    { alpha: (line) => seriesOf.get(line)?.alpha ?? 0.16, tone: (line) => seriesOf.get(line)?.tone ?? 0 },
  );
};

const level: ShapeBuilder = (g) =>
  shape(g, (line, u) => [u, lerp(0.12, 0.88, line / (g.lines - 1))], { alpha: () => 0.4 });

/** Some lines stay level, the rest stand up: an engineering grid with square cells. */
const grid: ShapeBuilder = (g) => {
  const rows = Math.max(2, Math.round((g.lines + 1) / (1 + g.aspect)));
  const columns = g.lines - rows;
  // Cell height as a fraction of the band's height; its width follows from the aspect ratio.
  const cell = Math.min(g.aspect / (columns + 1), 1 / (rows + 0.25));
  const rowOf = new Map<number, number>();
  for (let row = 0; row < rows; row++) rowOf.set(Math.floor(((row + 0.5) * g.lines) / rows), row);
  const columnOf = new Map<number, number>();
  for (let line = 0; line < g.lines; line++) if (!rowOf.has(line)) columnOf.set(line, columnOf.size);

  return shape(
    g,
    (line, u) => {
      const row = rowOf.get(line);
      if (row !== undefined) return [u, 0.5 + (row - (rows - 1) / 2) * cell];
      return [0.5 + ((columnOf.get(line) ?? 0) - (columns - 1) / 2) * (cell / g.aspect), u];
    },
    { alpha: () => 0.3 },
  );
};

export const MORPHS: Record<MorphKind, MorphSpec> = {
  "information-signal": { states: ["Text", "Retrieval", "Signal"], build: [text, retrieval, traces] },
  "waveform-chart": { states: ["Waveform", "Spectrum", "Series"], build: [traces, spectra, chart] },
  "chart-grid": { states: ["Series", "Level", "Grid"], build: [chart, level, grid] },
};
