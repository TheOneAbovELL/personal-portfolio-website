import { lerp, smoothstep } from "@/lib/motion";
import { illustrativeSeries } from "@/lib/quant";
import { circuit, circuitAt } from "@/components/figures/builds/_shared/b-circuit";
import { CLOSING_PLIES, coords } from "@/components/figures/builds/_shared/b-immortal";

/**
 * Geometry for the transitions between programmes (DATA_MORPH, docs/RACE-SYSTEM.md §8).
 *
 * A transition is one set of lines that passes through three named states. Every state is a
 * pure function of the line index and a position along the line, so the same lines can be
 * interpolated point for point: text becomes a retrieval graph becomes signal traces, and so
 * on. Nothing here is random at run time — the "noise" is hashed from the line index, so a
 * line has the same shape on every frame, every visit and every build.
 */

export type MorphKind =
  | "information-signal"
  | "waveform-chart"
  | "chart-grid"
  // Homepage, from v6: qEEG → Ripple → SatQuery AI → ARGUS.
  | "waveform-belief"
  | "ripple-raster"
  | "raster-series"
  // The /projects sequence.
  | "trace-bars"
  | "bars-context"
  | "context-attention"
  | "circuit-matrix"
  | "curves-board"
  | "board-track"
  | "track-grid"
  // /projects, from v6: F1 Replay → Semantic Recommendation Engine → the page.
  | "track-neighbours"
  | "neighbours-grid";

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

/* ============================================================================================
   The /projects sequence. Seven more transitions, each one physical movement from one
   programme's visual language into the next one's. A state shared by two transitions is one
   builder, so the shape a programme is entered with is exactly the shape it is left with.
   ============================================================================================ */

type Point = readonly [number, number];

/**
 * A polyline as a function of u (0 → 1). `shares` fixes how much of u each segment gets, so
 * two paths with the same vertex structure keep their corners aligned while they morph — a
 * rectangle stays a rectangle as it changes size. Without it, u runs by length (x measured in
 * band heights, so a segment's share matches what the eye sees).
 */
function path(vertices: readonly Point[], aspect: number, shares?: readonly number[]): (u: number) => Point {
  const weights =
    shares ??
    vertices.slice(1).map((v, i) => Math.hypot((v[0] - vertices[i][0]) * aspect, v[1] - vertices[i][1]));
  const total = weights.reduce((sum, w) => sum + w, 0);
  const stops = [0];
  for (const w of weights) stops.push(stops[stops.length - 1] + (total > 0 ? w / total : 1 / weights.length));
  return (u) => {
    let i = 0;
    while (i < weights.length - 1 && u > stops[i + 1]) i++;
    const span = stops[i + 1] - stops[i];
    const f = span > 0 ? Math.min(1, Math.max(0, (u - stops[i]) / span)) : 0;
    return [lerp(vertices[i][0], vertices[i + 1][0], f), lerp(vertices[i][1], vertices[i + 1][1], f)];
  };
}

const traced = (g: MorphGeometry, paths: ((u: number) => Point)[], style: LineStyle) =>
  shape(g, (line, u) => paths[line](u), style);

/* Boxes: a trace span, a score, a bar. One vertex structure — top-left, clockwise, with a
   whisker that can rise from the middle of the top edge — so each becomes the next. */
const BOX_SHARES = [0.15, 0.06, 0.06, 0.15, 0.2, 0.18, 0.2] as const;

function box(x0: number, x1: number, top: number, bottom: number, whisker = 0): Point[] {
  const mid = (x0 + x1) / 2;
  return [[x0, top], [mid, top], [mid, top - whisker], [mid, top], [x1, top], [x1, bottom], [x0, bottom], [x0, top]];
}

/**
 * The box's eight vertices as a row of tokens: the top edge carries the whole row and the rest
 * of the outline is folded into its end, so a bar's top stretches out into the line while its
 * sides and floor draw up into the end of it.
 */
function row(x0: number, x1: number, y: number): Point[] {
  const mid = (x0 + x1) / 2;
  return [[x0, y], [mid, y], [mid, y], [mid, y], [x1, y], [x1, y], [x1, y], [x1, y]];
}

/* TraceGrade: one agent run as a waterfall of spans — the run, its steps one after another,
   then the grader's checks side by side once the answer is in. */
const timeline: ShapeBuilder = (g) => {
  const last = g.lines - 1;
  const checks = Math.max(2, Math.round(g.lines / 4));
  const firstCheck = g.lines - checks;
  const weights = Array.from({ length: firstCheck - 1 }, (_, k) => 0.55 + hash(k + 21));
  const sum = weights.reduce((a, b) => a + b, 0);
  const answered = 0.68;
  const spans: [number, number][] = [[0.1, 0.9]];
  let x = 0.13;
  for (const w of weights) {
    const end = x + ((answered - 0.13) * w) / sum;
    spans.push([x, end - 0.004]);
    x = end;
  }
  for (let k = 0; k < checks; k++) spans.push([answered + 0.012, answered + 0.08 + 0.12 * hash(k + 57)]);
  const half = 0.27 / g.lines;
  return traced(
    g,
    spans.map(([x0, x1], line) => {
      const y = lerp(0.1, 0.9, line / last);
      return path(box(x0, x1, y - half, y + half), g.aspect, BOX_SHARES);
    }),
    {
      alpha: (line) => (line === 0 ? 0.42 : line >= firstCheck ? 0.92 : 0.7),
      tone: (line) => (line >= firstCheck ? 1 : 0),
    },
  );
};

/* RAG workbench: metrics compared across two runs — pairs of bars with interval whiskers. */
function barOf(g: MorphGeometry, line: number) {
  const metrics = Math.ceil(g.lines / 2);
  const pitch = 0.7 / metrics;
  const metric = Math.floor(line / 2);
  const run = line % 2;
  const value = 0.42 + 0.36 * hash(metric * 3 + 5) + (run ? (hash(metric + 77) - 0.4) * 0.16 : 0);
  return {
    centre: 0.15 + pitch * (metric + 0.5) + (run ? 1 : -1) * pitch * 0.19,
    half: pitch * 0.15,
    top: 0.9 - 0.74 * value,
    whisker: 0.035 + 0.045 * hash(line + 91),
    run,
  };
}

const scores: ShapeBuilder = (g) =>
  traced(
    g,
    Array.from({ length: g.lines }, (_, line) => {
      const { centre, half, top } = barOf(g, line);
      return path(box(centre - half * 0.6, centre + half * 0.6, top - 0.014, top + 0.014), g.aspect, BOX_SHARES);
    }),
    { alpha: () => 0.85, tone: (line) => barOf(g, line).run },
  );

const bars: ShapeBuilder = (g) =>
  traced(
    g,
    Array.from({ length: g.lines }, (_, line) => {
      const { centre, half, top, whisker } = barOf(g, line);
      return path(box(centre - half, centre + half, top, 0.9, whisker), g.aspect, BOX_SHARES);
    }),
    { alpha: (line) => (barOf(g, line).run ? 0.8 : 0.7), tone: (line) => barOf(g, line).run },
  );

/* The Context Illusion: a long sequence of tokens with one needle in it, then the window a
   model actually reads — the sequence packed between brackets, the needle at its depth. */
const needleOf = (g: MorphGeometry) => Math.round(g.lines * 0.62);

const tokens: ShapeBuilder = (g) => {
  const last = g.lines - 1;
  const needle = needleOf(g);
  return traced(
    g,
    Array.from({ length: g.lines }, (_, line) =>
      path(row(0.09, 0.91 - (line % 4 === 3 ? 0.18 * hash(line + 5) : 0), lerp(0.12, 0.88, line / last)), g.aspect, BOX_SHARES),
    ),
    { alpha: (line) => (line === needle ? 0.95 : 0.5), tone: (line) => (line === needle ? 1 : 0), words: 1 },
  );
};

const contextWindow: ShapeBuilder = (g) => {
  const last = g.lines - 1;
  const needle = needleOf(g);
  const span = Math.min(0.8, 1.15 / g.aspect);
  const left = 0.5 - span / 2;
  const right = 0.5 + span / 2;
  const serif = 0.05 / g.aspect;
  const pad = 0.035 / g.aspect;
  return traced(
    g,
    Array.from({ length: g.lines }, (_, line) => {
      if (line === 0) return path([[left + serif, 0.1], [left, 0.1], [left, 0.9], [left + serif, 0.9]], g.aspect);
      if (line === last) return path([[right - serif, 0.1], [right, 0.1], [right, 0.9], [right - serif, 0.9]], g.aspect);
      const end = right - pad - (line % 3 === 2 ? 0.3 * span * hash(line + 31) : 0);
      const y = lerp(0.2, 0.8, (line - 1) / Math.max(1, last - 2));
      return path([[left + pad, y], [end, y]], g.aspect);
    }),
    {
      alpha: (line) => (line === needle ? 0.95 : line === 0 || line === last ? 0.75 : 0.45),
      tone: (line) => (line === needle ? 1 : 0),
    },
  );
};

/* Inside the Transformers: attention as arcs from a token back to the tokens it reads, then
   the network as layers, with heads as the junctions along each one. */
const ARC_TOKENS = 24;

const arcs: ShapeBuilder = (g) =>
  shape(
    g,
    (line, u) => {
      // Arcs start and end on token positions, so they read as one sequence attending to itself.
      const at = (token: number) => lerp(0.12, 0.88, token / (ARC_TOKENS - 1));
      const query = 6 + Math.floor(hash(line + 40) * (ARC_TOKENS - 6));
      const key = Math.max(0, query - 1 - Math.floor(hash(line * 2 + 13) * Math.min(query, 14)));
      const height = Math.min(0.6, 0.08 + 0.042 * (query - key));
      return [(at(key) + at(query)) / 2 - ((at(query) - at(key)) / 2) * Math.cos(Math.PI * u), 0.84 - height * Math.sin(Math.PI * u)];
    },
    { alpha: (line) => (line % 5 === 2 ? 0.92 : 0.5), tone: (line) => (line % 5 === 2 ? 1 : 0) },
  );

const layers: ShapeBuilder = (g) => {
  const last = g.lines - 1;
  const circuit = new Set([Math.round(last * 0.3), Math.round(last * 0.7)]);
  return shape(g, (line, u) => [lerp(0.24, 0.76, u), lerp(0.12, 0.88, line / last)], {
    alpha: (line) => (circuit.has(line) ? 0.9 : 0.5),
    tone: (line) => (circuit.has(line) ? 1 : 0),
    nodes: 1,
  });
};

/* Beyond Quadratic Attention: the rows of a causal score matrix (each query sees the keys up
   to its own position), then theoretical cost curves — n² against a fan of n·w lines. */
const MATRIX = 0.84;

const rows: ShapeBuilder = (g) => {
  const width = MATRIX / g.aspect;
  const left = 0.5 - width / 2;
  return shape(
    g,
    (line, u) => [left + u * width * ((line + 1) / g.lines), 0.5 - MATRIX / 2 + ((line + 0.5) / g.lines) * MATRIX],
    { alpha: (line) => 0.4 + 0.4 * (line / (g.lines - 1)), tone: (line) => (line === g.lines - 1 ? 1 : 0) },
  );
};

const curves: ShapeBuilder = (g) => {
  const last = g.lines - 1;
  return shape(
    g,
    (line, u) => {
      // Line 0 is n²; the last is n; between them, n·w for a spread of window sizes w.
      const value = line === 0 ? u * u : line === last ? 0.07 * u : u * lerp(0.14, 0.86, (line - 1) / Math.max(1, last - 2));
      return [lerp(0.12, 0.88, u), 0.9 - 0.8 * value];
    },
    {
      alpha: (line) => (line === 0 ? 0.95 : line === last ? 0.75 : 0.4),
      tone: (line) => (line === 0 ? 1 : line === last ? 0.5 : 0),
    },
  );
};

/* ChessLab: an 8 × 8 lattice — first the causal attention mask (the lower triangle), then the
   full board. Each line threads a few of the lattice's rules end to end, turning along the
   border, so the board has its edge with only as many lines as the band has. */
const CELLS = 8;
const LATTICE = 0.82;

function boardFrame(g: MorphGeometry) {
  const width = LATTICE / g.aspect;
  const left = 0.5 - width / 2;
  const top = 0.5 - LATTICE / 2;
  return ([column, rank]: Point): Point => [left + (column / CELLS) * width, top + (rank / CELLS) * LATTICE];
}

function lattice(g: MorphGeometry, causal: boolean): MorphShape {
  const toBand = boardFrame(g);
  const horizontals = Math.ceil(g.lines / 2);
  const rules = CELLS + 1;
  const ruleAt = (vertical: boolean, r: number): [Point, Point] =>
    vertical
      ? [[r, causal ? Math.max(0, r - 1) : 0], [r, CELLS]]
      : [[0, r], [causal ? Math.min(r + 1, CELLS) : CELLS, r]];

  const paths = Array.from({ length: g.lines }, (_, line) => {
    const vertical = line >= horizontals;
    const count = vertical ? g.lines - horizontals : horizontals;
    const k = vertical ? line - horizontals : line;
    const first = Math.min(rules - 1, Math.floor((k * rules) / count));
    const end = Math.min(rules, Math.max(first + 1, Math.floor(((k + 1) * rules) / count)));
    const vertices: Point[] = [];
    const shares: number[] = [];
    for (let r = first; r < end; r++) {
      const [a, b] = ruleAt(vertical, r);
      const [from, to] = (r - first) % 2 === 0 ? [a, b] : [b, a];
      if (vertices.length) {
        const previous = vertices[vertices.length - 1];
        vertices.push([previous[0], from[1]], from);
        shares.push(0.125, 0.125);
      }
      if (!vertices.length) vertices.push(from);
      vertices.push(to);
      shares.push(1);
    }
    return path(vertices.map(toBand), g.aspect, shares);
  });
  return traced(g, paths, { alpha: () => (causal ? 0.42 : 0.5) });
}

const maskGrid: ShapeBuilder = (g) => lattice(g, true);
const board: ShapeBuilder = (g) => lattice(g, false);

/** The closing moves of the Immortal Game as arrows on the board, ending in 23.Be7#. */
const moves: ShapeBuilder = (g) => {
  const toBand = boardFrame(g);
  // Line 0 keeps the board's edge; the others take the game's last moves, oldest first.
  const total = CLOSING_PLIES.length;
  const arrows = g.lines - 1;
  const plyOf = (line: number) => CLOSING_PLIES[(total - Math.min(arrows, total) + line - 1 + total) % total];
  const centre = (square: Parameters<typeof coords>[0]): Point => {
    const [file, rank] = coords(square);
    return [file + 0.5, CELLS - rank - 0.5];
  };
  return traced(
    g,
    Array.from({ length: g.lines }, (_, line) => {
      if (line === 0) {
        const edge: Point[] = [[0, 0], [CELLS, 0], [CELLS, CELLS], [0, CELLS], [0, 0]];
        return path(edge.map(toBand), g.aspect);
      }
      const ply = plyOf(line);
      const from = centre(ply.from);
      const to = centre(ply.to);
      const df = Math.abs(to[0] - from[0]);
      const dr = Math.abs(to[1] - from[1]);
      const knight = (df === 1 && dr === 2) || (df === 2 && dr === 1);
      const corner: Point | null = knight ? (dr === 2 ? [from[0], to[1]] : [to[0], from[1]]) : null;
      const lead = corner ?? from;
      const length = Math.hypot(to[0] - lead[0], to[1] - lead[1]);
      const dir: Point = [(to[0] - lead[0]) / length, (to[1] - lead[1]) / length];
      const tip: Point = [to[0] - dir[0] * 0.12, to[1] - dir[1] * 0.12];
      const barb = (sign: number): Point => {
        const a = Math.PI - sign * 0.5;
        const c = Math.cos(a);
        const s = Math.sin(a);
        return [tip[0] + 0.36 * (dir[0] * c - dir[1] * s), tip[1] + 0.36 * (dir[0] * s + dir[1] * c)];
      };
      const startDir = corner ? [corner[0] - from[0], corner[1] - from[1]] : [dir[0], dir[1]];
      const startLength = Math.hypot(startDir[0], startDir[1]);
      const start: Point = [from[0] + (startDir[0] / startLength) * 0.18, from[1] + (startDir[1] / startLength) * 0.18];
      const shaft: Point[] = corner ? [start, corner, tip] : [start, tip];
      const legs = shaft.slice(1).map((v, i) => Math.hypot(v[0] - shaft[i][0], v[1] - shaft[i][1]));
      const run = legs.reduce((a, b) => a + b, 0);
      // The shaft takes most of the line, so the head stays a head as the arrow grows into a lane.
      const shares = [...legs.map((leg) => (0.88 * leg) / run), 0.04, 0.04, 0.04];
      return path([...shaft, barb(1), tip, barb(-1)].map(toBand), g.aspect, shares);
    }),
    {
      alpha: (line) => (line === 0 ? 0.35 : line === g.lines - 1 ? 1 : plyOf(line).white ? 0.75 : 0.4),
      tone: (line) => (line === g.lines - 1 ? 1 : 0),
    },
  );
};

/* F1 replay: the schematic circuit as a ribbon of lanes — edges, surface, a racing line —
   then the lap unrolled into a straight. */
const TRACK_WIDTH = 0.075;

const laneStyle = (g: MorphGeometry): LineStyle => {
  const last = g.lines - 1;
  const racing = Math.round(last / 2);
  return {
    alpha: (line) => (line === racing ? 0.9 : line === 0 || line === last ? 0.8 : 0.16),
    tone: (line) => (line === racing ? 1 : 0),
  };
};

const track: ShapeBuilder = (g) => {
  const outline = circuit();
  let height = 0.8;
  let width = (height * outline.aspect) / g.aspect;
  if (width > 0.84) {
    height *= 0.84 / width;
    width = 0.84;
  }
  const left = 0.5 - width / 2;
  const top = 0.5 - height / 2;
  return shape(
    g,
    (line, u) => {
      const offset = (line / (g.lines - 1) - 0.5) * TRACK_WIDTH;
      const { at, normal } = circuitAt(u);
      return [left + at[0] * width + (normal[0] * offset) / g.aspect, top + at[1] * height + normal[1] * offset];
    },
    laneStyle(g),
  );
};

const straight: ShapeBuilder = (g) =>
  shape(g, (line, u) => [lerp(0.08, 0.92, u), 0.5 + (line / (g.lines - 1) - 0.5) * 0.3], laneStyle(g));

/* ============================================================================================
   v6 — the homepage grows to five programmes and /projects gains a recommender. Each new
   transition starts from the shape the outgoing programme's figure speaks and ends in the shape
   the incoming one speaks; existing builders are reused where a state is shared, never edited.
   ============================================================================================ */

/* Ripple: one changed fact fanning out along its dependency links — wave 1, then wave 2 —
   and then the same lines as the waves themselves, rings travelling out from the fact. */
const FACT_X = 0.14;
/** The wave-1 group whose belief is revised: carried in the secondary colour through both states. */
const REVISED = 1;

const waveGroup = (g: MorphGeometry, line: number, groups: number) => Math.floor((line * groups) / g.lines);

const beliefGraph: ShapeBuilder = (g) => {
  const last = g.lines - 1;
  const layerX = [FACT_X, 0.4, 0.64, 0.86];
  return shape(
    g,
    (line, u) => {
      const layerY = [
        0.5,
        lerp(0.2, 0.8, waveGroup(g, line, 4) / 3),
        lerp(0.1, 0.9, waveGroup(g, line, 6) / 5),
        lerp(0.06, 0.94, line / last),
      ];
      const span = Math.min(2, Math.floor(u * 3));
      const f = u * 3 - span;
      return [lerp(layerX[span], layerX[span + 1], f), lerp(layerY[span], layerY[span + 1], smoothstep(0.1, 0.9, f))];
    },
    {
      alpha: (line) => (waveGroup(g, line, 4) === REVISED ? 0.9 : 0.5),
      tone: (line) => (waveGroup(g, line, 4) === REVISED ? 1 : 0),
      nodes: 1,
    },
  );
};

const rings: ShapeBuilder = (g) => {
  const last = g.lines - 1;
  return shape(
    g,
    (line, u) => {
      // Radius in band heights; x is divided by the aspect so the rings stay round.
      const radius = 0.07 + (line / last) * Math.min(1.25, 0.72 * g.aspect);
      const reach = radius > 0.47 ? Math.asin(0.47 / radius) : Math.PI / 2;
      const angle = lerp(-reach, reach, u);
      return [FACT_X + (radius * Math.cos(angle)) / g.aspect, 0.5 + radius * Math.sin(angle)];
    },
    {
      // One wave front carries the colour; the rest fade out with distance from the fact.
      alpha: (line) => (waveGroup(g, line, 4) === REVISED ? 0.9 : 0.62 - 0.36 * (line / last)),
      tone: (line) => (waveGroup(g, line, 4) === REVISED ? 1 : 0),
    },
  );
};

/* SatQuery AI: the rings straighten into a satellite's swath — parallel scan lines on a slant —
   and the swath squares up into a raster tile, the unit every question in the figure runs on. */
const swath: ShapeBuilder = (g) => {
  const last = g.lines - 1;
  const lit = Math.round(last * 0.55);
  return shape(
    g,
    (line, u) => {
      const base = lerp(0.22, 0.78, line / last);
      return [lerp(0.08, 0.92, u), base + 0.18 * (0.5 - u) + 0.03 * Math.sin(Math.PI * u)];
    },
    { alpha: (line) => (line === lit ? 0.85 : line % 3 === 1 ? 0.6 : 0.4), tone: (line) => (line === lit ? 1 : 0) },
  );
};

const TILE_CELLS = 10;
const TILE = 0.84;

/** A square raster tile, centred: each line threads a few of its row and column rules end to end. */
const raster: ShapeBuilder = (g) => {
  const width = TILE / g.aspect;
  const left = 0.5 - width / 2;
  const top = 0.5 - TILE / 2;
  const toBand = ([column, rank]: Point): Point => [left + (column / TILE_CELLS) * width, top + (rank / TILE_CELLS) * TILE];
  const horizontals = Math.ceil(g.lines / 2);
  const rules = TILE_CELLS + 1;
  const paths = Array.from({ length: g.lines }, (_, line) => {
    const vertical = line >= horizontals;
    const count = vertical ? g.lines - horizontals : horizontals;
    const k = vertical ? line - horizontals : line;
    const first = Math.min(rules - 1, Math.floor((k * rules) / count));
    const end = Math.min(rules, Math.max(first + 1, Math.floor(((k + 1) * rules) / count)));
    const vertices: Point[] = [];
    const shares: number[] = [];
    for (let r = first; r < end; r++) {
      const a: Point = vertical ? [r, 0] : [0, r];
      const b: Point = vertical ? [r, TILE_CELLS] : [TILE_CELLS, r];
      const [from, to] = (r - first) % 2 === 0 ? [a, b] : [b, a];
      if (vertices.length) {
        const previous = vertices[vertices.length - 1];
        vertices.push(vertical ? [previous[0], from[1]] : [from[0], previous[1]], from);
        shares.push(0.1, 0.1);
      } else vertices.push(from);
      vertices.push(to);
      shares.push(1);
    }
    return path(vertices.map(toBand), g.aspect, shares);
  });
  // The rules through the middle of the tile carry the measured change.
  const changed = (line: number) =>
    line === Math.floor(horizontals / 2) || line === horizontals + Math.floor((g.lines - horizontals) / 2);
  return traced(g, paths, { alpha: (line) => (changed(line) ? 0.85 : 0.42), tone: (line) => (changed(line) ? 1 : 0) });
};

/* SatQuery AI → ARGUS: the tile's rows read out as transects — pixel values, stepped — and the
   steps smooth into the market series the ARGUS figure plots. */
const PIXELS = 28;

const transect: ShapeBuilder = (g) => {
  const last = g.lines - 1;
  const lit = Math.round(last * 0.55);
  return shape(
    g,
    (line, u) => {
      const pixel = Math.min(PIXELS - 1, Math.floor(u * PIXELS));
      const value = hash(line * 31 + pixel * 7) - 0.5 + 0.35 * Math.sin((pixel / PIXELS) * TAU + line);
      return [lerp(0.07, 0.93, u), lerp(0.14, 0.86, line / last) + 0.032 * value];
    },
    { alpha: (line) => (line === lit ? 0.9 : 0.45), tone: (line) => (line === lit ? 1 : 0) },
  );
};

/* Semantic Recommendation Engine: the straight's lanes swing round into an embedding
   neighbourhood — rays from the query to its nearest products — and the neighbours re-rank into
   a shortlist, whose rows level out into the grid the page is drawn on. */
const QUERY: Point = [0.5, 0.5];

/** Line k is the k-th nearest neighbour. Re-ranking moves a few of them: rank is not distance. */
function rankOf(g: MorphGeometry, line: number): number {
  const order = Array.from({ length: g.lines }, (_, k) => k).sort((a, b) => a + 2.6 * hash(a + 71) - (b + 2.6 * hash(b + 71)));
  return order.indexOf(line);
}

const neighbours: ShapeBuilder = (g) => {
  const last = g.lines - 1;
  return shape(
    g,
    (line, u) => {
      const angle = TAU * hash(line * 5 + 3) + line * 2.4;
      const radius = 0.1 + 0.32 * Math.pow(line / last, 0.85);
      const end: Point = [QUERY[0] + (radius * Math.cos(angle) * 1.6) / g.aspect, QUERY[1] + radius * Math.sin(angle)];
      return [lerp(QUERY[0], end[0], u), lerp(QUERY[1], end[1], u)];
    },
    { alpha: (line) => 0.95 - 0.6 * (line / last), tone: (line) => (rankOf(g, line) < 3 ? 1 : 0) },
  );
};

const shortlist: ShapeBuilder = (g) => {
  const last = g.lines - 1;
  return shape(
    g,
    (line, u) => {
      const rank = rankOf(g, line);
      const length = 0.62 * (1 - 0.6 * (rank / last));
      return [lerp(0.19, 0.19 + length, u), lerp(0.12, 0.88, rank / last)];
    },
    {
      alpha: (line) => 0.9 - 0.5 * (rankOf(g, line) / last),
      tone: (line) => (rankOf(g, line) < 3 ? 1 : 0),
    },
  );
};

export const MORPHS: Record<MorphKind, MorphSpec> = {
  "information-signal": { states: ["Text", "Retrieval", "Signal"], build: [text, retrieval, traces] },
  "waveform-chart": { states: ["Waveform", "Spectrum", "Series"], build: [traces, spectra, chart] },
  "chart-grid": { states: ["Series", "Level", "Grid"], build: [chart, level, grid] },
  "trace-bars": { states: ["Timeline", "Scores", "Bars"], build: [timeline, scores, bars] },
  "bars-context": { states: ["Bars", "Tokens", "Window"], build: [bars, tokens, contextWindow] },
  "context-attention": { states: ["Window", "Arcs", "Layers"], build: [contextWindow, arcs, layers] },
  "circuit-matrix": { states: ["Layers", "Rows", "Curves"], build: [layers, rows, curves] },
  "curves-board": { states: ["Curves", "Grid", "Board"], build: [curves, maskGrid, board] },
  "board-track": { states: ["Board", "Moves", "Track"], build: [board, moves, track] },
  "track-grid": { states: ["Track", "Straight", "Grid"], build: [track, straight, grid] },
  "waveform-belief": { states: ["Waveform", "Dependencies", "Waves"], build: [traces, beliefGraph, rings] },
  "ripple-raster": { states: ["Waves", "Swath", "Raster"], build: [rings, swath, raster] },
  "raster-series": { states: ["Raster", "Transect", "Series"], build: [raster, transect, chart] },
  "track-neighbours": { states: ["Track", "Straight", "Neighbours"], build: [track, straight, neighbours] },
  "neighbours-grid": { states: ["Neighbours", "Shortlist", "Grid"], build: [neighbours, shortlist, grid] },
};
