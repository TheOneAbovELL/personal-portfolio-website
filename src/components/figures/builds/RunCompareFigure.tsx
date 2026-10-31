"use client";

import { useMemo, useState } from "react";
import { seeded, unit } from "./_shared/a-shared";

/**
 * RAG Evaluation Workbench — two runs compared the way the workbench compares them: per metric,
 * a mean with a bootstrap confidence interval for each run, and beside it the paired,
 * question-by-question difference with its own interval and the wins / ties / losses count.
 *
 * Every per-question score here is GENERATED from a hash of (run, metric, question) — they are
 * not results. The statistics are then really computed from those generated scores (percentile
 * bootstrap, fixed seed), so the figure shows the method honestly on made-up inputs. Metric
 * names, the offline baseline (BM25 + extractive), the retriever names, the exclusion of skipped
 * scores and the regression gate's exit codes are the README's.
 *
 * Interaction: choose the candidate run; intervals and differences move to the new comparison.
 */

const BASE_INK = "var(--color-bone)";
const CAND_INK = "rgb(var(--prog, 60 207 192))";
const FLAG_INK = "rgb(var(--prog-2, 242 194 48))";

const QUESTIONS = 30;
const RESAMPLES = 1000;
const TIE = 0.01;
const DIFF_SPAN = 0.2;

interface MetricSpec {
  id: string;
  family: "Lexical" | "Semantic" | "LLM judge";
  base: number;
  spread: number;
  /** Shift the candidate applies, per candidate. */
  shift: [number, number];
}

const METRICS: MetricSpec[] = [
  { id: "token_f1", family: "Lexical", base: 0.46, spread: 0.32, shift: [0.03, -0.02] },
  { id: "context_recall", family: "Lexical", base: 0.62, spread: 0.36, shift: [0.09, -0.14] },
  { id: "semantic_similarity", family: "Semantic", base: 0.68, spread: 0.24, shift: [0.04, -0.01] },
  { id: "semantic_context_recall", family: "Semantic", base: 0.58, spread: 0.3, shift: [0.08, -0.11] },
];

const CANDIDATES = [
  { id: "hybrid", label: "hybrid-local · k=3", note: "BM25 + local embeddings, fused by RRF" },
  { id: "k1", label: "bm25 · k=1", note: "one retrieved chunk instead of three" },
] as const;

const BASELINE = { label: "bm25 · k=3", note: "offline baseline: BM25 + extractive answers" };

const clamp01 = (v: number) => (v < 0 ? 0 : v > 1 ? 1 : v);

/** Approximately normal noise from two hashed uniforms (Irwin–Hall, four terms). */
const noise = (...keys: number[]) => {
  let s = 0;
  for (let k = 0; k < 4; k++) s += unit(...keys, k);
  return (s - 2) / 0.577;
};

function scores(run: number, metric: number): number[] {
  const spec = METRICS[metric];
  const out: number[] = [];
  for (let q = 0; q < QUESTIONS; q++) {
    // A question's difficulty is shared by every run, which is exactly why pairing helps.
    const difficulty = noise(7, metric, q) * spec.spread * 0.8;
    const shift = run === 0 ? 0 : spec.shift[run - 1];
    const jitter = noise(run + 11, metric, q) * spec.spread * 0.32;
    out.push(clamp01(spec.base + difficulty + shift + jitter));
  }
  return out;
}

const mean = (xs: number[]) => xs.reduce((a, b) => a + b, 0) / xs.length;

/** Percentile bootstrap of the mean, 95%. */
function bootstrap(xs: number[], seed: number): [number, number] {
  const rand = seeded(seed);
  const means: number[] = [];
  for (let r = 0; r < RESAMPLES; r++) {
    let s = 0;
    for (let i = 0; i < xs.length; i++) s += xs[Math.floor(rand() * xs.length)];
    means.push(s / xs.length);
  }
  means.sort((a, b) => a - b);
  return [means[Math.floor(0.025 * RESAMPLES)], means[Math.ceil(0.975 * RESAMPLES) - 1]];
}

interface Row {
  id: string;
  family: string;
  base: { mean: number; ci: [number, number] };
  cand: { mean: number; ci: [number, number] };
  diff: { mean: number; ci: [number, number]; wins: number; ties: number; losses: number };
  regression: boolean;
}

function compare(candidate: number): Row[] {
  return METRICS.map((spec, m) => {
    const a = scores(0, m);
    const b = scores(candidate + 1, m);
    const d = b.map((v, i) => v - a[i]);
    const diffCi = bootstrap(d, 9000 + m * 31 + candidate);
    return {
      id: spec.id,
      family: spec.family,
      base: { mean: mean(a), ci: bootstrap(a, 100 + m) },
      cand: { mean: mean(b), ci: bootstrap(b, 200 + m * 7 + candidate) },
      diff: {
        mean: mean(d),
        ci: diffCi,
        wins: d.filter((v) => v > TIE).length,
        ties: d.filter((v) => Math.abs(v) <= TIE).length,
        losses: d.filter((v) => v < -TIE).length,
      },
      regression: diffCi[1] < 0,
    };
  });
}

const signed = (v: number) => `${v >= 0 ? "+" : "−"}${Math.abs(v).toFixed(2)}`;
const pct = (v: number) => `${(v * 100).toFixed(2)}%`;
const diffPct = (v: number) => pct(0.5 + Math.max(-DIFF_SPAN, Math.min(DIFF_SPAN, v)) / (2 * DIFF_SPAN));

const MOVE = "transition-[left,width] duration-[var(--dur-base)] ease-[var(--ease-out)]";

function Whisker({ lo, hi, at, ink, top }: { lo: number; hi: number; at: number; ink: string; top: string }) {
  return (
    <>
      <span aria-hidden="true" className={`absolute h-px ${MOVE}`} style={{ left: pct(lo), width: pct(hi - lo), top, background: ink }} />
      <span
        aria-hidden="true"
        className={`absolute h-[7px] w-[7px] -translate-x-1/2 -translate-y-1/2 transition-[left] duration-[var(--dur-base)] ease-[var(--ease-out)]`}
        style={{ left: pct(at), top, background: ink }}
      />
      <span aria-hidden="true" className={`absolute h-[7px] w-px -translate-y-1/2 ${MOVE}`} style={{ left: pct(lo), top, background: ink }} />
      <span aria-hidden="true" className={`absolute h-[7px] w-px -translate-y-1/2 ${MOVE}`} style={{ left: pct(hi), top, background: ink }} />
    </>
  );
}

export function RunCompareFigure({ wide = false }: { wide?: boolean }) {
  const [candidate, setCandidate] = useState(0);
  const all = useMemo(() => CANDIDATES.map((_, c) => compare(c)), []);
  const rows = all[candidate];
  const regressions = rows.filter((row) => row.regression);
  const exit = regressions.length > 0 ? 3 : 0;

  const cols = wide
    ? "md:grid-cols-[12.5rem_minmax(0,1fr)_minmax(0,0.8fr)_8.5rem]"
    : "sm:grid-cols-[minmax(0,1fr)_minmax(0,0.75fr)_6.5rem]";

  return (
    <div>
      <div className="flex flex-wrap items-center justify-between gap-x-6 gap-y-3 pb-4">
        <div className="flex flex-wrap items-center gap-x-4 gap-y-2">
          <p id="compare-candidate" className="label text-steel">
            Candidate run
          </p>
          <div role="group" aria-labelledby="compare-candidate" className="flex">
            {CANDIDATES.map((item, index) => {
              const on = index === candidate;
              return (
                <button
                  key={item.id}
                  type="button"
                  aria-pressed={on}
                  onClick={() => setCandidate(index)}
                  className={`label -ml-px min-h-9 border px-3 transition-colors duration-[var(--dur-fast)] ease-[var(--ease-snap)] first:ml-0 ${
                    on ? "relative z-10" : "border-rule-strong text-steel hover:text-bone"
                  }`}
                  style={on ? { borderColor: CAND_INK, color: CAND_INK } : undefined}
                >
                  {item.label}
                </button>
              );
            })}
          </div>
        </div>
        <p className="label text-faint">Illustrative — generated scores, not results</p>
      </div>

      <p className="label flex flex-wrap items-center gap-x-5 gap-y-1.5 pb-3 text-steel" aria-hidden="true">
        <span className="flex items-center gap-2">
          <span className="size-[7px]" style={{ background: BASE_INK }} />
          Baseline <span className="text-faint normal-case tracking-normal">{BASELINE.label}</span>
        </span>
        <span className="flex items-center gap-2">
          <span className="size-[7px]" style={{ background: CAND_INK }} />
          Candidate <span className="text-faint normal-case tracking-normal">{CANDIDATES[candidate].label}</span>
        </span>
        <span className="flex items-center gap-2">
          <span className="h-px w-4 bg-steel" />
          95% bootstrap CI
        </span>
      </p>

      <div
        role="table"
        aria-label={`Illustrative comparison of the baseline run (${BASELINE.label}) and the candidate run (${CANDIDATES[candidate].label}) over ${QUESTIONS} generated questions.`}
      >
        <div role="row" className={`hidden gap-x-5 border-b border-rule-strong pb-2 ${wide ? "md:grid" : "sm:grid"} ${cols}`}>
          <span role="columnheader" className={`label text-faint ${wide ? "" : "sm:hidden"}`}>
            Metric
          </span>
          <span role="columnheader" className="label flex justify-between text-faint">
            <span>Mean · run by run</span>
            <span>0 — 1</span>
          </span>
          <span role="columnheader" className="label flex justify-between text-faint">
            <span>Paired Δ</span>
            <span>±{DIFF_SPAN}</span>
          </span>
          <span role="columnheader" className="label text-right text-faint">
            W · T · L
          </span>
        </div>

        {rows.map((row) => (
          <div
            key={row.id}
            role="row"
            className={`grid grid-cols-[minmax(0,1fr)] gap-x-5 gap-y-2 border-b border-rule py-3 ${wide ? "md:items-center" : "sm:items-center"} ${cols}`}
          >
            <span role="cell" className={`flex items-baseline justify-between gap-3 ${wide ? "md:block" : "sm:col-span-3"}`}>
              <span className="readout text-[0.8125rem] text-bone">{row.id}</span>
              <span className={`label text-faint ${wide ? "md:mt-0.5 md:block" : ""}`}>{row.family}</span>
            </span>

            <span role="cell" className="relative block h-9" aria-label={`Baseline mean ${row.base.mean.toFixed(2)}, candidate mean ${row.cand.mean.toFixed(2)}`}>
              {[0, 0.25, 0.5, 0.75, 1].map((t) => (
                <span
                  key={t}
                  aria-hidden="true"
                  className={`absolute w-px ${t === 0 || t === 1 ? "top-0 bottom-0 bg-metal-3" : "top-1.5 bottom-1.5 bg-rule-strong"}`}
                  style={{ left: pct(t) }}
                />
              ))}
              <Whisker lo={row.base.ci[0]} hi={row.base.ci[1]} at={row.base.mean} ink={BASE_INK} top="30%" />
              <Whisker lo={row.cand.ci[0]} hi={row.cand.ci[1]} at={row.cand.mean} ink={CAND_INK} top="70%" />
            </span>

            <span role="cell" className="grid grid-cols-[minmax(0,1fr)_auto] items-center gap-x-3">
              <span className="relative block h-9" aria-hidden="true">
                <span className="absolute inset-x-0 top-1/2 h-px bg-rule-strong" />
                <span className="absolute top-0 bottom-0 left-1/2 w-px bg-metal-3" />
                <span
                  className={`absolute top-1/2 h-px ${MOVE}`}
                  style={{
                    left: diffPct(row.diff.ci[0]),
                    width: `calc(${diffPct(row.diff.ci[1])} - ${diffPct(row.diff.ci[0])})`,
                    background: row.regression ? FLAG_INK : CAND_INK,
                  }}
                />
                <span
                  className="absolute top-1/2 h-[9px] w-[3px] -translate-x-1/2 -translate-y-1/2 transition-[left,background-color] duration-[var(--dur-base)] ease-[var(--ease-out)]"
                  style={{ left: diffPct(row.diff.mean), background: row.regression ? FLAG_INK : CAND_INK }}
                />
              </span>
              <span className="readout w-[3.25rem] text-right text-[0.8125rem]" style={{ color: row.regression ? FLAG_INK : "var(--color-bone)" }}>
                {signed(row.diff.mean)}
              </span>
            </span>

            <span
              role="cell"
              className={`label flex items-baseline justify-between gap-3 text-steel ${wide ? "md:block md:text-right" : "sm:block sm:text-right"}`}
            >
              <span className={`text-faint ${wide ? "md:hidden" : "sm:hidden"}`}>Wins · ties · losses</span>
              <span className="readout">
                {row.diff.wins} · {row.diff.ties} · {row.diff.losses}
              </span>
            </span>
          </div>
        ))}

        <div role="row" className={`grid grid-cols-[minmax(0,1fr)] gap-x-5 gap-y-1 border-b border-rule py-3 ${wide ? "md:items-baseline" : "sm:items-baseline"} ${cols}`}>
          <span role="cell" className={`flex items-baseline justify-between gap-3 ${wide ? "md:block" : "sm:col-span-3"}`}>
            <span className="readout text-[0.8125rem] text-steel">faithfulness</span>
            <span className={`label text-faint ${wide ? "md:mt-0.5 md:block" : ""}`}>LLM judge</span>
          </span>
          <span role="cell" className={`text-[0.8125rem] leading-snug text-steel ${wide ? "md:col-span-3" : "sm:col-span-3"}`}>
            Skipped in both runs — no provider configured. Skipped scores are counted, never averaged as zero.
          </span>
        </div>
      </div>

      <div className="mt-4 flex flex-wrap items-baseline justify-between gap-x-6 gap-y-2">
        <p className="readout text-[0.8125rem] text-steel">
          <span className="text-faint">$</span> ragwb regress baseline candidate{" "}
          <span style={{ color: exit ? FLAG_INK : CAND_INK }}>→ exit {exit}</span>
        </p>
        <p className="label text-steel" aria-live="polite">
          {exit
            ? `Significant regression · ${regressions.map((row) => row.id).join(", ")}`
            : "No significant regression"}
        </p>
      </div>
    </div>
  );
}

export const CAPTION =
  "Two pipeline runs compared question by question: each run's mean with a 95% bootstrap interval, then the paired difference and its wins, ties and losses. Illustrative — the per-question scores are generated, not results; the statistics are really computed from them. Switch the candidate to see the regression gate change.";
