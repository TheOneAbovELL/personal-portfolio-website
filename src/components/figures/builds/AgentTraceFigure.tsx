"use client";

import { useEffect, useRef, useState } from "react";
import { useOnScreen } from "./_shared/a-shared";

/**
 * TraceGrade — one agent run as a trace, and the checks that grade it.
 *
 * The run is the README's own example case (customer C2001 refunding a $49 headset bought on
 * 2026-11-12, with 2026-11-20 as the dataset's reference date) drawn schematically: the steps
 * and argument shapes follow the expected tool calls in the dataset schema, the values are that
 * example's. Every step is selectable to show what TraceGrade records for it, and the metrics
 * that read that step light up beneath. While on screen and untouched, the selection walks the
 * trace in order; the first click takes over and the walk stops for good.
 *
 * Colour: the programme colour is what is selected; the second colour is reserved for the one
 * step with a side effect (the refund ticket), because that is the action TraceGrade exists to
 * verify actually happened.
 */

const INK = "rgb(var(--prog, 242 194 48))";
const EFFECT = "rgb(var(--prog-2, 215 38 47))";
const STEP_MS = 1800;

type MetricId =
  | "refund_outcome"
  | "expected_tool_coverage"
  | "forbidden_tool_avoidance"
  | "tool_argument_match"
  | "tool_order"
  | "answer_action_consistency"
  | "deepeval_tool_correctness"
  | "task_completion"
  | "step_efficiency"
  | "plan_quality"
  | "plan_adherence"
  | "argument_correctness"
  | "answer_correctness";

interface Step {
  actor: "User" | "Tool" | "Agent";
  name: string;
  /** One line, shown in the trace itself. */
  gist: string;
  recorded: { field: string; value: string }[];
  sideEffect?: string;
  reads: MetricId[];
}

const TOOL_CHECKS: MetricId[] = [
  "expected_tool_coverage",
  "forbidden_tool_avoidance",
  "tool_order",
  "deepeval_tool_correctness",
  "step_efficiency",
  "plan_adherence",
];

const STEPS: Step[] = [
  {
    actor: "User",
    name: "input",
    gist: "“I'm customer C2001, please refund my headset”",
    recorded: [
      { field: "Message", value: "I'm customer C2001, please refund my headset" },
      { field: "Reference date", value: "2026-11-20 — fixed by the dataset, not the machine clock" },
    ],
    reads: ["task_completion", "plan_quality"],
  },
  {
    actor: "Tool",
    name: "get_purchase_history",
    gist: "customer_id → purchase records",
    recorded: [
      { field: "Arguments", value: '{ "customer_id": "C2001" }' },
      { field: "Output", value: '{ "headset": { "price": 49, "date": "2026-11-12" } }' },
    ],
    reads: [...TOOL_CHECKS, "tool_argument_match", "argument_correctness"],
  },
  {
    actor: "Tool",
    name: "get_current_date",
    gist: "→ the dataset's reference date",
    recorded: [
      { field: "Arguments", value: "{ }" },
      { field: "Output", value: '"2026-11-20"' },
    ],
    reads: TOOL_CHECKS,
  },
  {
    actor: "Tool",
    name: "calculate_refund",
    gist: "items checked against the 30-day window",
    recorded: [
      { field: "Arguments", value: '{ "customer_id": "C2001", "items": [{ "name": "headset" }] }' },
      { field: "Output", value: "8 days since purchase — inside 30 days → 49" },
    ],
    reads: [...TOOL_CHECKS, "tool_argument_match", "argument_correctness"],
  },
  {
    actor: "Tool",
    name: "issue_refund_ticket",
    gist: "the one call with a side effect",
    recorded: [
      { field: "Arguments", value: '{ "customer_id": "C2001", "amount": 49 }' },
      { field: "Output", value: "ticket issued" },
    ],
    sideEffect: "Ledger +1 ticket · $49 · C2001",
    reads: [
      ...TOOL_CHECKS,
      "tool_argument_match",
      "argument_correctness",
      "refund_outcome",
      "answer_action_consistency",
    ],
  },
  {
    actor: "Agent",
    name: "final answer",
    gist: "“A refund ticket for $49 has been issued.”",
    recorded: [
      { field: "Answer", value: "A refund ticket for $49 has been issued." },
      { field: "Reference", value: "A refund ticket for $49 is issued." },
    ],
    reads: ["answer_action_consistency", "answer_correctness", "task_completion"],
  },
];

/** Kinds and default thresholds are the README's. */
const DETERMINISTIC: { id: MetricId; threshold: string }[] = [
  { id: "refund_outcome", threshold: "1.0" },
  { id: "expected_tool_coverage", threshold: "1.0" },
  { id: "forbidden_tool_avoidance", threshold: "1.0" },
  { id: "tool_argument_match", threshold: "1.0" },
  { id: "tool_order", threshold: "1.0" },
  { id: "answer_action_consistency", threshold: "1.0" },
  { id: "deepeval_tool_correctness", threshold: "0.9" },
];

const JUDGE: { id: MetricId; threshold: string }[] = [
  { id: "task_completion", threshold: "0.8" },
  { id: "step_efficiency", threshold: "0.8" },
  { id: "plan_quality", threshold: "0.8" },
  { id: "plan_adherence", threshold: "0.8" },
  { id: "argument_correctness", threshold: "0.9" },
  { id: "answer_correctness", threshold: "0.8" },
];

/** The step shown before anything moves, and the static state under reduced motion. */
const INITIAL = 4;

export function AgentTraceFigure({ wide = false }: { wide?: boolean }) {
  const rootRef = useRef<HTMLDivElement>(null);
  const onScreen = useOnScreen(rootRef);
  const [selected, setSelected] = useState(INITIAL);
  const [taken, setTaken] = useState(false);

  useEffect(() => {
    if (!onScreen || taken) return;
    const timer = window.setInterval(() => setSelected((i) => (i + 1) % STEPS.length), STEP_MS);
    return () => window.clearInterval(timer);
  }, [onScreen, taken]);

  const step = STEPS[selected];
  const reads = new Set(step.reads);

  const choose = (index: number) => {
    setTaken(true);
    setSelected(index);
  };

  const metricRow = (metric: { id: MetricId; threshold: string }, judge: boolean) => {
    const lit = reads.has(metric.id);
    return (
      <li
        key={metric.id}
        className="grid grid-cols-[minmax(0,1fr)_auto_3.75rem] items-baseline gap-x-2 border-t border-rule py-1.5 transition-opacity duration-[var(--dur-fast)]"
        style={{ opacity: lit ? 1 : 0.4 }}
      >
        <span className="readout flex min-w-0 items-baseline gap-2 text-[0.75rem]" style={{ color: lit ? INK : "var(--color-bone)" }}>
          <span
            aria-hidden="true"
            className="size-1.5 shrink-0 -translate-y-px transition-colors duration-[var(--dur-fast)]"
            style={{ background: lit ? INK : "var(--color-metal-2)" }}
          />
          <span className="min-w-0 break-words">
            {/* Long identifiers may wrap, but only at their underscores. */}
            {metric.id.split("_").map((part, i) => (
              <span key={i}>
                {i > 0 && (
                  <>
                    _<wbr />
                  </>
                )}
                {part}
              </span>
            ))}
          </span>
        </span>
        <span className="label text-right text-faint">≥{metric.threshold}</span>
        <span className={`label text-right ${judge ? "text-faint" : "text-bone"}`}>{judge ? "Skipped" : "Pass"}</span>
      </li>
    );
  };

  return (
    <div ref={rootRef}>
      <div className="flex flex-wrap items-baseline justify-between gap-x-6 gap-y-1 pb-4">
        <p className="label text-steel">
          Case refund-headset <span className="text-faint">— offline reference model · policy enforced</span>
        </p>
        <p className="label text-faint">Schematic run — README example case</p>
      </div>

      <div
        className={`grid gap-x-8 gap-y-5 ${
          wide ? "md:grid-cols-[minmax(0,1.15fr)_minmax(0,1fr)]" : "sm:grid-cols-[minmax(0,1.05fr)_minmax(0,1fr)]"
        }`}
      >
        {/* The trace: one row per recorded step, hanging from one wire. */}
        <div>
          <p id="trace-steps" className="label pb-1 text-steel">
            Execution trace
          </p>
          <ol aria-labelledby="trace-steps" className="relative">
            <span aria-hidden="true" className="absolute bottom-6 left-[0.46875rem] top-6 w-px bg-rule-strong" />
            {STEPS.map((item, index) => {
              const on = index === selected;
              const tool = item.actor === "Tool";
              return (
                <li key={item.name}>
                  <button
                    type="button"
                    aria-pressed={on}
                    aria-controls="trace-record"
                    onClick={() => choose(index)}
                    className="group relative grid w-full grid-cols-[1rem_4.25rem_minmax(0,1fr)] items-center gap-x-3 py-2 text-left"
                  >
                    <span aria-hidden="true" className="flex justify-center">
                      <span
                        className="block size-2 border transition-colors duration-[var(--dur-fast)]"
                        style={{
                          background: on ? INK : "var(--color-carbon)",
                          borderColor: on ? INK : item.sideEffect ? EFFECT : "var(--color-metal-3)",
                        }}
                      />
                    </span>
                    <span className="label transition-colors duration-[var(--dur-fast)]" style={{ color: on ? INK : "var(--color-faint)" }}>
                      {String(index + 1).padStart(2, "0")} {item.actor}
                    </span>
                    <span className="min-w-0">
                      <span
                        className={`block truncate text-[0.875rem] leading-tight transition-colors duration-[var(--dur-fast)] ${
                          tool ? "readout" : "font-medium"
                        } ${on ? "" : "text-bone"}`}
                        style={on ? { color: INK } : undefined}
                      >
                        {item.name}
                      </span>
                      <span className="mt-0.5 block truncate text-[0.8125rem] leading-snug text-steel">{item.gist}</span>
                    </span>
                  </button>
                </li>
              );
            })}
          </ol>
        </div>

        {/* What is recorded for the selected step. */}
        <div id="trace-record" className="flex min-w-0 flex-col border-t border-rule-strong pt-4 sm:border-l sm:border-t-0 sm:pl-6 sm:pt-0">
          <p className="label flex items-baseline justify-between gap-3 pb-1 text-steel">
            <span>
              Recorded <span className="text-faint">— step {String(selected + 1).padStart(2, "0")}</span>
            </span>
            <span className="text-faint">Read by {step.reads.length}</span>
          </p>
          <dl className="border-b border-rule">
            {step.recorded.map((row) => (
              <div key={row.field} className="border-t border-rule py-2.5 first:border-t-0">
                <dt className="label text-faint">{row.field}</dt>
                <dd className="readout mt-1 break-words text-[0.8125rem] leading-snug text-bone">{row.value}</dd>
              </div>
            ))}
            <div className="border-t border-rule py-2.5">
              <dt className="label text-faint">Side effect</dt>
              <dd
                className="readout mt-1 flex items-center gap-2 text-[0.8125rem]"
                style={{ color: step.sideEffect ? EFFECT : "var(--color-faint)" }}
              >
                {step.sideEffect && <span aria-hidden="true" className="h-3 w-[3px] shrink-0" style={{ background: EFFECT }} />}
                {step.sideEffect ?? "None"}
              </dd>
            </div>
          </dl>
          <p className="mt-3 text-[0.8125rem] leading-snug text-steel">
            The agent runs once per case; every metric grades that same recorded execution.
          </p>
        </div>
      </div>

      {/* The graders. Lit rows are the metrics that read the selected step. */}
      <div className="mt-6 grid gap-x-8 gap-y-5 sm:grid-cols-2">
        <div>
          <p className="label flex justify-between gap-3 pb-1 text-steel">
            Deterministic checks <span className="text-faint">Exact</span>
          </p>
          <ul className="border-b border-rule">{DETERMINISTIC.map((metric) => metricRow(metric, false))}</ul>
        </div>
        <div>
          <p className="label flex justify-between gap-3 pb-1 text-steel">
            LLM-as-a-judge <span className="text-faint">Model opinion</span>
          </p>
          <ul className="border-b border-rule">{JUDGE.map((metric) => metricRow(metric, true))}</ul>
          <p className="mt-3 text-[0.8125rem] leading-snug text-steel">
            Offline, no judge is configured: these are skipped, and skipped never counts as a pass.
          </p>
        </div>
      </div>
    </div>
  );
}

export const CAPTION =
  "One agent run as TraceGrade records it — the README's example refund case, drawn schematically. Select a step to see what is captured and which metrics read it. Deterministic checks and LLM-judge metrics are kept apart and never merged into one score.";
