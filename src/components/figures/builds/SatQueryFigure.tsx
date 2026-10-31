"use client";

import { useEffect, useMemo, useRef, useState } from "react";
import { unit, useOnScreen, useReducedMotion } from "./_shared/a-shared";

/**
 * SatQuery AI — the four documented demo flows on generated tiles.
 *
 * The queries, the routing rule (by asset modality: two optical → change analysis, one SAR → the
 * SAR specialist, optical + SAR → cross-modal evidence, one optical → the vision-language
 * specialist), the tool names, the measurements each tool reports and the five-stage execution
 * trace are the README's. The tiles are GENERATED here — they are not satellite data — and every
 * number shown is really computed from them, the way the tools compute theirs. The answer text
 * is a schematic composed from those numbers, not model output.
 */

export const CAPTION =
  "Generated tiles — not satellite data. The queries, routing, tools and five-stage trace follow the README; every number is computed from the tiles, and the answer is a schematic composed from those numbers, not model output.";

const N = 32;
const CELLS = N * N;

/* ---- Generated rasters ------------------------------------------------------------------- */

/** A smooth field in [0, 1]: a few broad undulations plus fine texture. */
function field(seed: number): Float32Array {
  const out = new Float32Array(CELLS);
  for (let y = 0; y < N; y++)
    for (let x = 0; x < N; x++) {
      const u = x / N;
      const v = y / N;
      const broad =
        0.5 +
        0.22 * Math.sin(6.1 * u + 2.3 * v + seed) +
        0.16 * Math.sin(3.7 * v - 4.4 * u + seed * 2) +
        0.1 * Math.sin(11 * u * v + seed);
      out[y * N + x] = Math.min(1, Math.max(0, broad + 0.12 * (unit(seed, x, y) - 0.5)));
    }
  return out;
}

/** The simulated second scene: the first, plus a cleared, brightened patch (new construction, say). */
function withChange(t1: Float32Array): Float32Array {
  const t2 = new Float32Array(t1);
  for (let y = 0; y < N; y++)
    for (let x = 0; x < N; x++) {
      const inside = (x - 20.5) ** 2 / 30 + (y - 11.5) ** 2 / 14 < 1 || (x >= 9 && x <= 12 && y >= 22 && y <= 25);
      if (inside) t2[y * N + x] = Math.min(1, t1[y * N + x] + 0.42 + 0.08 * unit(9, x, y));
      else t2[y * N + x] = Math.min(1, Math.max(0, t1[y * N + x] + 0.05 * (unit(8, x, y) - 0.5)));
    }
  return t2;
}

/** Linear SAR backscatter: speckled low returns, with one cluster of strong reflectors. */
function sarLinear(): Float32Array {
  const out = new Float32Array(CELLS);
  for (let y = 0; y < N; y++)
    for (let x = 0; x < N; x++) {
      const speckle = -Math.log(1 - 0.98 * unit(31, x, y)); // exponential, like single-look speckle
      const strong = (x - 23) ** 2 + (y - 13) ** 2 < 7 ? 16 + 6 * unit(32, x, y) : 0;
      out[y * N + x] = 0.02 * speckle + 0.02 * strong;
    }
  return out;
}

/* ---- The tools, reduced to their arithmetic ---------------------------------------------- */

const quantile = (sorted: number[], q: number) => {
  const i = (sorted.length - 1) * q;
  const lo = Math.floor(i);
  return sorted[lo] + (sorted[Math.min(sorted.length - 1, lo + 1)] - sorted[lo]) * (i - lo);
};

/** 4-connected regions in a mask. */
function regions(mask: Uint8Array): number {
  const seen = new Uint8Array(CELLS);
  let count = 0;
  for (let i = 0; i < CELLS; i++) {
    if (!mask[i] || seen[i]) continue;
    count++;
    const stack = [i];
    seen[i] = 1;
    while (stack.length) {
      const k = stack.pop()!;
      const x = k % N;
      const y = (k - x) / N;
      for (const [dx, dy] of [[1, 0], [-1, 0], [0, 1], [0, -1]]) {
        const nx = x + dx;
        const ny = y + dy;
        if (nx < 0 || ny < 0 || nx >= N || ny >= N) continue;
        const j = ny * N + nx;
        if (mask[j] && !seen[j]) {
          seen[j] = 1;
          stack.push(j);
        }
      }
    }
  }
  return count;
}

type Box = [number, number, number, number];

function bbox(mask: Uint8Array): Box | null {
  let x0 = N, y0 = N, x1 = -1, y1 = -1;
  for (let i = 0; i < CELLS; i++)
    if (mask[i]) {
      const x = i % N;
      const y = (i - x) / N;
      x0 = Math.min(x0, x);
      y0 = Math.min(y0, y);
      x1 = Math.max(x1, x);
      y1 = Math.max(y1, y);
    }
  return x1 < 0 ? null : [x0, y0, x1 + 1, y1 + 1];
}

function iou(a: Box, b: Box): number {
  const ix = Math.max(0, Math.min(a[2], b[2]) - Math.max(a[0], b[0]));
  const iy = Math.max(0, Math.min(a[3], b[3]) - Math.max(a[1], b[1]));
  const inter = ix * iy;
  const area = (r: Box) => (r[2] - r[0]) * (r[3] - r[1]);
  return inter / (area(a) + area(b) - inter);
}

const CHANGE_THRESHOLD = 0.25;
const SAR_CUT = 0.98;

function analyse() {
  const t1 = field(1.3);
  const t2 = withChange(t1);
  const change = new Uint8Array(CELLS);
  let changed = 0;
  for (let i = 0; i < CELLS; i++) {
    if (Math.abs(t2[i] - t1[i]) > CHANGE_THRESHOLD) {
      change[i] = 1;
      changed++;
    }
  }

  const linear = sarLinear();
  const db = Array.from(linear, (v) => 10 * Math.log10(Math.max(v, 1e-6)));
  const sorted = [...db].sort((a, b) => a - b);
  const lo = quantile(sorted, 0.02);
  const hi = quantile(sorted, 0.98);
  const clipped = db.map((v) => Math.min(hi, Math.max(lo, v)));
  const clippedSorted = [...clipped].sort((a, b) => a - b);
  const p99 = quantile(sorted, 0.99);
  // High returns are thresholded; the cut here is the 98th percentile of the scene.
  const cut = quantile(sorted, SAR_CUT);
  const high = new Uint8Array(CELLS);
  let highCount = 0;
  for (let i = 0; i < CELLS; i++)
    if (db[i] >= cut) {
      high[i] = 1;
      highCount++;
    }

  const changeBox = bbox(change);
  const sarBox = bbox(high);
  const overlap = changeBox && sarBox ? iou(changeBox, sarBox) : 0;

  return {
    t1,
    t2,
    change,
    changed,
    fraction: changed / CELLS,
    changeRegions: regions(change),
    changeBox,
    db,
    dbRange: [sorted[0], sorted[CELLS - 1]] as const,
    high,
    highCount,
    sarStats: {
      mean: clipped.reduce((a, b) => a + b, 0) / CELLS,
      median: quantile(clippedSorted, 0.5),
      p99,
    },
    sarRegions: regions(high),
    sarBox,
    sarInside:
      !!changeBox &&
      !!sarBox &&
      sarBox[0] >= changeBox[0] &&
      sarBox[1] >= changeBox[1] &&
      sarBox[2] <= changeBox[2] &&
      sarBox[3] <= changeBox[3],
    iou: overlap,
  };
}

const DATA = analyse();

/* ---- Flows -------------------------------------------------------------------------------- */

type FlowId = "vqa" | "change" | "sar" | "cross";

interface Flow {
  id: FlowId;
  label: string;
  query: string;
  assets: string;
  tool: string;
  path: string;
}

const FLOWS: Flow[] = [
  {
    id: "vqa",
    label: "Scene",
    query: "What does this satellite image show?",
    assets: "1 optical",
    tool: "visual_language_specialist",
    path: "Qwen2-VL + RS LoRA",
  },
  {
    id: "change",
    label: "Change",
    query: "What changed between these two images?",
    assets: "2 optical",
    tool: "bi_temporal_change_analysis",
    path: "NumPy / SciPy + Rasterio",
  },
  {
    id: "sar",
    label: "SAR",
    query: "What are the strongest backscatter regions?",
    assets: "1 SAR",
    tool: "sar_analysis",
    path: "SAR statistics + thresholds",
  },
  {
    id: "cross",
    label: "Optical + SAR",
    query: "Compare the optical and SAR evidence.",
    assets: "Optical + SAR",
    tool: "cross_modal_evidence",
    path: "Change mask × SAR returns → bbox IoU",
  },
];

const TRACE = ["Tool requested", "Input validated", "Execution started", "Execution completed", "Result validated"];

/* ---- Drawing ------------------------------------------------------------------------------ */

const LEVELS = 7;

/** One path per brightness level: a tile in seven draw calls instead of a thousand. */
function levelPaths(values: ArrayLike<number>, min: number, max: number): string[] {
  const paths = Array.from({ length: LEVELS }, () => "");
  for (let i = 0; i < CELLS; i++) {
    const x = i % N;
    const y = (i - x) / N;
    const t = (values[i] - min) / (max - min || 1);
    const level = Math.min(LEVELS - 1, Math.max(0, Math.floor(t * LEVELS)));
    paths[level] += `M${x} ${y}h1v1h-1z`;
  }
  return paths;
}

function maskPath(mask: Uint8Array): string {
  let d = "";
  for (let i = 0; i < CELLS; i++)
    if (mask[i]) {
      const x = i % N;
      d += `M${x} ${(i - x) / N}h1v1h-1z`;
    }
  return d;
}

function Tile({
  values,
  min,
  max,
  mask,
  box,
  boxTone,
  label,
}: {
  values: ArrayLike<number>;
  min: number;
  max: number;
  mask?: { d: string; tone: string };
  box?: { b: Box; tone: string; dashed?: boolean }[];
  boxTone?: string;
  label: string;
}) {
  const paths = useMemo(() => levelPaths(values, min, max), [values, min, max]);
  return (
    <figure className="min-w-0">
      <svg viewBox={`-0.5 -0.5 ${N + 1} ${N + 1}`} className="block h-auto w-full" shapeRendering="crispEdges" aria-hidden="true">
        <rect x={-0.5} y={-0.5} width={N + 1} height={N + 1} fill="var(--color-carbon)" />
        {paths.map((d, level) => (
          <path key={level} d={d} fill="var(--color-bone)" opacity={0.06 + (0.62 * level) / (LEVELS - 1)} />
        ))}
        {mask && <path d={mask.d} fill={mask.tone} opacity={0.72} />}
        {box?.map(({ b, tone, dashed }, k) => (
          <rect
            key={k}
            x={b[0]}
            y={b[1]}
            width={b[2] - b[0]}
            height={b[3] - b[1]}
            fill="none"
            stroke={tone}
            strokeWidth={0.35}
            strokeDasharray={dashed ? "0.9 0.6" : undefined}
            shapeRendering="geometricPrecision"
          />
        ))}
        <rect x={-0.5} y={-0.5} width={N + 1} height={N + 1} fill="none" stroke={boxTone ?? "var(--color-rule-strong)"} strokeWidth={0.2} />
      </svg>
      <figcaption className="label mt-1.5 text-faint">{label}</figcaption>
    </figure>
  );
}

const pct = (v: number) => `${(v * 100).toFixed(2)}%`;
const dB = (v: number) => `${v.toFixed(1)} dB`;

export function SatQueryFigure({ wide = false }: { wide?: boolean }) {
  const data = DATA;
  const [flow, setFlow] = useState<FlowId>("change");
  const [stage, setStage] = useState(TRACE.length);
  const rootRef = useRef<HTMLElement>(null);
  const onScreen = useOnScreen(rootRef, 0.3);
  const reduced = useReducedMotion();
  const current = FLOWS.find((f) => f.id === flow)!;
  const shownStage = reduced ? TRACE.length : stage;

  // The trace fills in stage by stage after each query, while the figure is on screen.
  useEffect(() => {
    if (!onScreen || stage >= TRACE.length) return;
    const timer = window.setTimeout(() => setStage((s) => s + 1), 420);
    return () => window.clearTimeout(timer);
  }, [onScreen, stage]);

  const ask = (id: FlowId) => {
    setFlow(id);
    setStage(0);
  };

  const CHANGE_INK = "rgb(var(--prog-2))";
  const SAR_INK = "rgb(var(--prog))";
  const sarMin = data.dbRange[0];
  const sarMax = data.dbRange[1];
  const relation = data.iou > 0.5 ? "Agreement" : data.iou > 0 ? "Complementary" : "Disagreement";
  const deterministic = flow !== "vqa";
  const done = shownStage >= TRACE.length;

  const measurements: { label: string; value: string }[] =
    flow === "change"
      ? [
          { label: "changed_pixel_count", value: String(data.changed) },
          { label: "change_fraction", value: pct(data.fraction) },
          { label: "regions", value: String(data.changeRegions) },
          { label: "threshold", value: `|ΔT| > ${CHANGE_THRESHOLD}` },
        ]
      : flow === "sar"
        ? [
            { label: "mean (clipped)", value: dB(data.sarStats.mean) },
            { label: "median", value: dB(data.sarStats.median) },
            { label: "p99", value: dB(data.sarStats.p99) },
            { label: "≥ p98 px · regions", value: `${data.highCount} · ${data.sarRegions}` },
          ]
        : flow === "cross"
          ? [
              { label: "optical change px", value: String(data.changed) },
              { label: "SAR high px", value: String(data.highCount) },
              { label: "bbox_iou", value: data.iou.toFixed(2) },
              { label: "relationship *", value: relation },
            ]
          : [];

  const answer =
    flow === "change"
      ? `Change detected across ${pct(data.fraction)} of the scene — ${data.changed} pixels in ${data.changeRegions} regions, the largest in the upper right.`
      : flow === "sar"
        ? `${data.sarRegions === 1 ? "One compact high-backscatter region stands out" : `${data.sarRegions} high-backscatter regions stand out`} (p99 ${dB(data.sarStats.p99)}): a candidate reflective target, not identified as a building or vehicle without corroborating evidence.`
        : flow === "cross"
          ? `${data.sarInside ? "The SAR returns sit inside the optical change envelope, which is much larger" : "The SAR and optical envelopes overlap only in part"} (bbox IoU ${data.iou.toFixed(2)}): ${relation.toLowerCase()} evidence — spatial corroboration, not ground truth.`
          : "Open-ended: the model describes the scene from the image. No measurement is involved, and none is quoted.";

  return (
    <figure ref={rootRef}>
      <div role="group" aria-label="Demo query" className="flex flex-wrap gap-x-1 gap-y-2 pb-3">
        {FLOWS.map((f) => {
          const on = f.id === flow;
          return (
            <button
              key={f.id}
              type="button"
              aria-pressed={on}
              onClick={() => ask(f.id)}
              className={`label min-h-9 rounded-full border px-3.5 transition-colors duration-[var(--dur-fast)] ${
                on ? "border-[rgb(var(--prog)/0.55)] bg-[rgb(var(--prog)/0.1)] text-bone" : "border-transparent text-steel hover:bg-[rgb(239_235_228/0.04)] hover:text-bone"
              }`}
            >
              {f.label}
            </button>
          );
        })}
      </div>

      <p className="border-t border-rule-strong pt-3 text-[0.9875rem] text-bone">
        <span aria-hidden="true" className="prog-ink mr-2">
          ›
        </span>
        {current.query}
      </p>

      <div className={`mt-4 grid gap-x-6 gap-y-5 ${wide ? "md:grid-cols-[minmax(0,1fr)_minmax(0,1fr)]" : "sm:grid-cols-[minmax(0,1fr)_minmax(0,1.05fr)]"}`}>
        {/* The assets, with the evidence the tool produced drawn on them. */}
        <div className="grid grid-cols-2 gap-3 self-start">
          {flow === "vqa" && (
            <div className="col-span-2 max-w-[17rem]">
              <Tile values={data.t1} min={0} max={1} label="Optical · T1 (generated)" />
            </div>
          )}
          {flow === "change" && (
            <>
              <Tile values={data.t1} min={0} max={1} label="Optical · T1" />
              <Tile
                values={data.t2}
                min={0}
                max={1}
                mask={{ d: maskPath(data.change), tone: CHANGE_INK }}
                label="T2 · change mask"
              />
            </>
          )}
          {flow === "sar" && (
            <div className="col-span-2 max-w-[17rem]">
              <Tile
                values={data.db}
                min={sarMin}
                max={sarMax}
                mask={{ d: maskPath(data.high), tone: SAR_INK }}
                label="SAR · dB, ≥ p98 marked"
              />
            </div>
          )}
          {flow === "cross" && (
            <>
              <Tile
                values={data.t2}
                min={0}
                max={1}
                box={data.changeBox ? [{ b: data.changeBox, tone: CHANGE_INK }] : []}
                label="Optical change · bbox"
              />
              <Tile
                values={data.db}
                min={sarMin}
                max={sarMax}
                box={[
                  ...(data.sarBox ? [{ b: data.sarBox, tone: SAR_INK }] : []),
                  ...(data.changeBox ? [{ b: data.changeBox, tone: CHANGE_INK, dashed: true }] : []),
                ]}
                label="SAR returns · bbox"
              />
            </>
          )}
        </div>

        {/* Route → measurement → interpretation. */}
        <dl className="grid content-start gap-y-4 text-[0.875rem]">
          <div>
            <dt className="label text-faint">Route · {current.assets}</dt>
            <dd className="mt-1">
              <span className="readout prog-ink text-[0.8125rem]">{current.tool}</span>
              <span className="mt-0.5 block text-steel">{current.path}</span>
            </dd>
          </div>
          <div>
            <dt className="label text-faint">
              Measurement · deterministic{deterministic ? " · confidence 1.0" : ""}
            </dt>
            <dd className="mt-1">
              {measurements.length ? (
                <table className="readout w-full text-[0.8125rem]">
                  <tbody>
                    {measurements.map((m) => (
                      <tr key={m.label} className="border-b border-rule">
                        <th scope="row" className="py-1 pr-3 text-left font-normal text-steel">
                          {m.label}
                        </th>
                        <td className={`py-1 text-right ${done ? "text-bone" : "text-metal-3"}`}>{done ? m.value : "…"}</td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              ) : (
                <span className="text-steel">None — an interpretive question goes straight to the model.</span>
              )}
            </dd>
          </div>
          <div>
            <dt className="label text-faint">Interpretation · Qwen2-VL{deterministic ? "" : " · confidence placeholder"}</dt>
            <dd className={`mt-1 leading-snug transition-opacity duration-[var(--dur-base)] ${done ? "text-bone opacity-100" : "opacity-30"}`}>
              {answer}
              <span className="label mt-1 block text-faint">
                Schematic answer — not model output{flow === "cross" ? " · * illustrative IoU cut-offs" : ""}
              </span>
            </dd>
          </div>
        </dl>
      </div>

      {/* The execution trace every request produces. */}
      <ol className="mt-5 grid grid-cols-1 gap-x-2 gap-y-2 border-t border-rule pt-3 sm:grid-cols-5" aria-label="Execution trace">
        {TRACE.map((name, k) => {
          const lit = k < shownStage;
          return (
            <li key={name} className="min-w-0">
              <span
                aria-hidden="true"
                className={`block h-px transition-colors duration-[var(--dur-fast)] ${lit ? "prog-bg" : "bg-rule-strong"}`}
              />
              <span className={`label mt-2 block truncate ${lit ? "text-bone" : "text-metal-3"}`}>
                <span className="text-faint">{k + 1} </span>
                {name}
              </span>
            </li>
          );
        })}
      </ol>
      <p className="sr-only" aria-live="polite">
        {done ? `${current.tool} completed. ${answer}` : ""}
      </p>
    </figure>
  );
}
