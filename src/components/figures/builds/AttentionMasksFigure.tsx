"use client";

import { useEffect, useRef, useState } from "react";
import { prefersReducedMotion } from "@/lib/motion";

/**
 * Beyond Quadratic Attention — which keys each query may read, for each family of backend the
 * laboratory implements, beside the theoretical cost of that pattern as the sequence grows.
 *
 * The masks are schematic (a 16-token sequence, a window of 5, blocks of 4); the curves are
 * the closed-form growth rates, not measurements. The motion is one query row stepping down
 * the matrix while the figure is on screen, lighting the keys it reads.
 */

export const CAPTION =
  "Which keys each query reads, per backend family, on a schematic 16-token sequence; the curves are theoretical growth rates, not measured runtimes.";

type FamilyId = "exact" | "local" | "block" | "linear";

interface Family {
  id: FamilyId;
  label: string;
  backends: string[];
  note: string;
  /** Growth of the work per head, in sequence length L (constants dropped). */
  cost: string;
  /** For the cost curve: work at length L. */
  work: (L: number) => number;
}

const W = 128;
const KB = 192;
const D = 64;

const FAMILIES: Family[] = [
  {
    id: "exact",
    label: "Exact",
    backends: ["naive", "sdpa_math", "sdpa_flash_cpu", "tiled", "tiled_recompute"],
    note: "Every query reads every key. The naive reference materialises all L² scores; the tiled backends compute the same softmax a tile at a time.",
    cost: "L²",
    work: (L) => L * L,
  },
  {
    id: "local",
    label: "Local window",
    backends: ["local_window"],
    note: "Each query reads a band of nearby keys. Restricted softmax — not the same pattern as dense attention.",
    cost: `L·w`,
    work: (L) => L * Math.min(L, W),
  },
  {
    id: "block",
    label: "Block sparse",
    backends: ["block_sparse"],
    note: "Local, global and random blocks, gathered. Restricted softmax — not the same pattern as dense attention.",
    cost: "L·k·b",
    work: (L) => L * Math.min(L, KB),
  },
  {
    id: "linear",
    label: "Linear (ELU)",
    backends: ["linear_elu"],
    note: "No L × L score matrix: φ(Q)·(φ(K)ᵀV) with φ(x) = elu(x) + 1. A different formulation — not softmax attention.",
    cost: "L·d",
    work: (L) => L * D,
  },
];

/* Schematic sequence */
const N = 16;
const WINDOW = 2;
const BLOCK = 4;
/** One extra block per block-row, from a fixed table: the "random" blocks, made repeatable. */
const RANDOM_BLOCK = [2, 3, 1, 1];

function reads(family: FamilyId, q: number, k: number): boolean {
  switch (family) {
    case "exact":
      return true;
    case "local":
      return Math.abs(q - k) <= WINDOW;
    case "block": {
      const bq = Math.floor(q / BLOCK);
      const bk = Math.floor(k / BLOCK);
      return bq === bk || bq === 0 || bk === 0 || RANDOM_BLOCK[bq] === bk;
    }
    case "linear":
      return false;
  }
}

const STEP_MS = 260;
const STATIC_ROW = 10;

/* Matrix geometry (SVG units) */
const CELL = 13;
const GAP = 2;
const PITCH = CELL + GAP;
const M_LEFT = 22;
const M_TOP = 22;
const M_SIZE = N * PITCH - GAP;

function MaskMatrix({ family, row }: { family: Family; row: number }) {
  const count = Array.from({ length: N }, (_, k) => reads(family.id, row, k)).filter(Boolean).length;
  return (
    <svg
      viewBox={`0 0 ${M_LEFT + M_SIZE + 4} ${M_TOP + M_SIZE + 4}`}
      className="block h-auto w-full max-w-[19rem]"
      role="img"
      aria-label={`${family.label} attention pattern on a schematic ${N}-token sequence: query ${row + 1} reads ${count} of ${N} keys.`}
    >
      <text x={M_LEFT} y={10} className="label" fill="var(--color-faint)">
        Keys →
      </text>
      <text
        x={10}
        y={M_TOP}
        className="label"
        fill="var(--color-faint)"
        transform={`rotate(90 10 ${M_TOP})`}
      >
        Queries →
      </text>
      {Array.from({ length: N }, (_, q) =>
        Array.from({ length: N }, (_, k) => {
          const on = reads(family.id, q, k);
          const active = q === row;
          return (
            <rect
              key={`${q}-${k}`}
              x={M_LEFT + k * PITCH}
              y={M_TOP + q * PITCH}
              width={CELL}
              height={CELL}
              fill={on ? (active ? "rgb(var(--prog-2))" : "rgb(var(--prog) / 0.42)") : active ? "rgb(var(--prog) / 0.08)" : "transparent"}
              stroke={on ? "none" : "var(--color-rule-strong)"}
              strokeWidth={1}
              vectorEffect="non-scaling-stroke"
            />
          );
        }),
      )}
      {/* The active query, marked in the gutter. */}
      <path
        d={`M${M_LEFT - 8} ${M_TOP + row * PITCH + CELL / 2 - 4}l5 4-5 4z`}
        fill="rgb(var(--prog-2))"
        className="transition-transform"
      />
    </svg>
  );
}

/** The linear family has no score matrix: draw the factorisation it uses instead. */
function LinearFactor({ row }: { row: number }) {
  const cols = 4;
  const block = (x: number, y: number, rows: number, columns: number, lit: (r: number) => boolean, label: string) => (
    <g>
      {Array.from({ length: rows }, (_, r) =>
        Array.from({ length: columns }, (_, c) => (
          <rect
            key={`${r}-${c}`}
            x={x + c * PITCH}
            y={y + r * PITCH}
            width={CELL}
            height={CELL}
            fill={lit(r) ? "rgb(var(--prog-2))" : "rgb(var(--prog) / 0.3)"}
          />
        )),
      )}
      <text x={x} y={y - 8} className="label" fill="var(--color-steel)">
        {label}
      </text>
    </g>
  );
  const top = M_TOP;
  const colWidth = cols * PITCH;
  const x2 = M_LEFT + colWidth + 26;
  const x3 = x2 + colWidth + 26;
  return (
    <svg
      viewBox={`0 0 ${x3 + colWidth + 4} ${M_TOP + M_SIZE + 4}`}
      className="block h-auto w-full max-w-[19rem]"
      role="img"
      aria-label={`Linear attention computes φ(K)ᵀV once as a small d by d summary; each query, here query ${row + 1}, is multiplied by that summary, so no L by L matrix is formed.`}
    >
      {block(M_LEFT, top, N, cols, (r) => r === row, "φ(Q)")}
      <text x={M_LEFT + colWidth + 8} y={top + M_SIZE / 2} className="label" fill="var(--color-faint)">
        ×
      </text>
      {block(x2, top, cols, cols, () => false, "φ(K)ᵀV")}
      <text x={x2} y={top + colWidth + 14} className="label" fill="var(--color-faint)">
        d × d
      </text>
      <text x={x2 + colWidth + 8} y={top + M_SIZE / 2} className="label" fill="var(--color-faint)">
        =
      </text>
      {block(x3, top, N, cols, (r) => r === row, "Out")}
    </svg>
  );
}

/* Cost curves (log–log) */
const C = { w: 420, h: 250, left: 12, right: 56, top: 22, bottom: 34 };
const L_MIN = 256;
const L_MAX = 16384;

function CostCurves({ selected }: { selected: FamilyId }) {
  const all = FAMILIES.flatMap((f) => [f.work(L_MIN), f.work(L_MAX)]);
  const yMin = Math.log2(Math.min(...all));
  const yMax = Math.log2(Math.max(...all));
  const x = (L: number) => C.left + ((Math.log2(L) - Math.log2(L_MIN)) / (Math.log2(L_MAX) - Math.log2(L_MIN))) * (C.w - C.left - C.right);
  const y = (v: number) => C.top + (1 - (Math.log2(v) - yMin) / (yMax - yMin)) * (C.h - C.top - C.bottom);
  const ticks = [256, 1024, 4096, 16384];
  const curve = (f: Family) => {
    let d = "";
    for (let k = 0; k <= 48; k++) {
      const L = L_MIN * (L_MAX / L_MIN) ** (k / 48);
      d += `${k === 0 ? "M" : "L"}${x(L).toFixed(1)} ${y(f.work(L)).toFixed(1)}`;
    }
    return d;
  };
  // End labels, nudged apart where curves finish close together.
  const labelY = new Map<FamilyId, number>();
  [...FAMILIES]
    .sort((a, b) => y(a.work(L_MAX)) - y(b.work(L_MAX)))
    .reduce((previous, f) => {
      const at = Math.max(y(f.work(L_MAX)), previous + 13);
      labelY.set(f.id, Math.round(at));
      return at;
    }, -Infinity);
  const ordered = [...FAMILIES.filter((f) => f.id !== selected), FAMILIES.find((f) => f.id === selected)!];
  return (
    <svg
      viewBox={`0 0 ${C.w} ${C.h}`}
      className="block h-auto w-full"
      role="img"
      aria-label="Theoretical growth of attention work per head with sequence length, log–log: L squared for exact attention, L times w for a local window, L times k times b for block sparse, L times d for linear attention. Mathematical curves, not measurements."
    >
      {ticks.map((L) => (
        <g key={L}>
          <line x1={x(L)} x2={x(L)} y1={C.top} y2={C.h - C.bottom} stroke="var(--color-rule)" strokeWidth={1} vectorEffect="non-scaling-stroke" />
          <text x={x(L)} y={C.h - C.bottom + 16} textAnchor="middle" className="label" fill="var(--color-faint)">
            {L >= 1024 ? `${L / 1024}k` : L}
          </text>
        </g>
      ))}
      <text x={C.w - C.right} y={C.h - 3} textAnchor="end" className="label" fill="var(--color-faint)">
        Sequence length L (log)
      </text>
      <text x={C.left} y={12} className="label" fill="var(--color-faint)">
        Work (log)
      </text>
      <line x1={C.left} x2={C.w - C.right} y1={C.h - C.bottom} y2={C.h - C.bottom} stroke="var(--color-rule-strong)" strokeWidth={1} vectorEffect="non-scaling-stroke" />
      {ordered.map((f) => {
        const on = f.id === selected;
        return (
          <g key={f.id}>
            <path
              d={curve(f)}
              fill="none"
              stroke={on ? "rgb(var(--prog))" : "var(--color-metal-3)"}
              strokeWidth={on ? 2 : 1}
              strokeDasharray={f.id === "linear" && !on ? "3 4" : undefined}
              vectorEffect="non-scaling-stroke"
            />
            <text
              x={C.w - C.right + 6}
              y={(labelY.get(f.id) ?? 0) + 4}
              className="label"
              fill={on ? "rgb(var(--prog))" : "var(--color-faint)"}
            >
              {f.cost}
            </text>
          </g>
        );
      })}
    </svg>
  );
}

export function AttentionMasksFigure({ wide = false }: { wide?: boolean }) {
  const [selected, setSelected] = useState<FamilyId>("local");
  const [row, setRow] = useState(STATIC_ROW);
  const [playing, setPlaying] = useState(false);
  const rootRef = useRef<HTMLElement>(null);

  // The query row steps down the matrix only while the figure is on screen.
  useEffect(() => {
    const root = rootRef.current;
    if (!root || prefersReducedMotion()) return;
    const observer = new IntersectionObserver(([entry]) => setPlaying(entry.isIntersecting), { threshold: 0.3 });
    observer.observe(root);
    return () => observer.disconnect();
  }, []);

  useEffect(() => {
    if (!playing) return;
    const timer = window.setInterval(() => setRow((r) => (r + 1) % N), STEP_MS);
    return () => window.clearInterval(timer);
  }, [playing]);

  const family = FAMILIES.find((f) => f.id === selected)!;
  const keys = Array.from({ length: N }, (_, k) => reads(family.id, row, k)).filter(Boolean).length;

  return (
    <figure ref={rootRef}>
      <div className="flex flex-wrap items-center justify-between gap-x-6 gap-y-3 pb-4">
        <p id="attention-family" className="label text-steel">
          Backend family
        </p>
        <div role="group" aria-labelledby="attention-family" className="flex flex-wrap">
          {FAMILIES.map((f) => {
            const on = f.id === selected;
            return (
              <button
                key={f.id}
                type="button"
                aria-pressed={on}
                onClick={() => setSelected(f.id)}
                className={`label -ml-px min-h-9 border px-3 transition-colors duration-[var(--dur-fast)] ease-[var(--ease-snap)] first:ml-0 ${
                  on ? "relative z-10 border-[rgb(var(--prog))] text-[rgb(var(--prog))]" : "border-rule-strong text-steel hover:text-bone"
                }`}
              >
                {f.label}
              </button>
            );
          })}
        </div>
      </div>

      <div className={`grid gap-x-8 gap-y-6 border-t border-rule pt-5 ${wide ? "md:grid-cols-[minmax(0,19rem)_minmax(0,1fr)]" : ""}`}>
        <div>
          <div className="flex items-baseline justify-between gap-3 pb-2">
            <p className="label text-steel">{family.id === "linear" ? "No score matrix" : "Mask · L = 16"}</p>
            <p className="label text-faint">Schematic</p>
          </div>
          {family.id === "linear" ? <LinearFactor row={row} /> : <MaskMatrix family={family} row={row} />}
          <p className="readout mt-3 text-[0.875rem] text-bone">
            Query {String(row + 1).padStart(2, "0")}
            <span className="text-faint"> · </span>
            {family.id === "linear" ? (
              <span className="text-steel">one d × d product, any L</span>
            ) : (
              <span className="text-steel">
                reads <span className="prog-ink-2">{keys}</span> of {N} keys
              </span>
            )}
          </p>
        </div>

        <div className="min-w-0">
          <div className="flex items-baseline justify-between gap-3 pb-2">
            <p className="label text-steel">Work per head</p>
            <p className="label text-faint">Theoretical — not measured</p>
          </div>
          <CostCurves selected={selected} />
          <p className="mt-3 text-[0.875rem] leading-snug text-steel">{family.note}</p>
          <p className="label mt-3 flex flex-wrap gap-x-3 gap-y-1 text-faint">
            {family.backends.map((b) => (
              <span key={b} className="normal-case tracking-normal text-bone">
                {b}
              </span>
            ))}
          </p>
        </div>
      </div>

      <p className="label mt-5 border-t border-rule pt-3 text-faint">
        Curves: closed-form growth, constants dropped — w = {W}, k·b = {KB}, d = {D} chosen for illustration.
      </p>
      <p className="sr-only" aria-live="polite">
        Showing {family.label}: {family.note}
      </p>
    </figure>
  );
}
