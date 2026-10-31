"use client";

import { useEffect, useRef, useState } from "react";
import { useOnScreen, useReducedMotion } from "./_shared/a-shared";

/**
 * Ripple — the README's own example, "My CGPA is now 8.6", played through the system.
 *
 * Two parts, kept visibly apart because the separation is the design: the ripple engine walks
 * the dependency links wave by wave (deterministic traversal, never a model call), and the
 * resolver chain decides each belief — domain rules first, a schema-validated model for the
 * rest — as keep, update, retire or ask. Selecting a belief answers "why do you believe this?".
 *
 * Illustrative: the openings (Acme and Beta are the README's names), the old CGPA, the cutoffs
 * and the derived beliefs are made up to show the mechanism. Nothing here is a Ripple run.
 */

export const CAPTION =
  "Illustrative — not a Ripple run. The README's example statement, with a made-up profile: the engine finds what a change reaches by graph traversal alone; rules or a schema-validated model then decide each belief, and every decision keeps its reason.";

type Decision = "keep" | "update" | "retire" | "ask";
type Resolver = "rule" | "model";

interface Belief {
  id: string;
  wave: 1 | 2;
  label: string;
  /** What this belief was derived from. */
  from: string[];
  resolver: Resolver;
  decision: Decision;
  before: string;
  after: string;
  reason: string;
  evidence: string[];
  /** Position on its wave, in degrees from the axis through the fact. */
  angle: number;
}

const FACT = { label: "CGPA", before: "v1 · 8.2", after: "v2 · 8.6", statement: "My CGPA is now 8.6" };

const BELIEFS: Belief[] = [
  {
    id: "elig-acme",
    wave: 1,
    label: "Eligible · Acme",
    from: ["CGPA"],
    resolver: "rule",
    decision: "update",
    before: "Not eligible",
    after: "Eligible",
    reason: "The eligibility rule computes it: 8.6 meets Acme's 8.5 cutoff on the same 10-point scale.",
    evidence: ["CGPA v2 — the student's statement", "Acme opening — \"minimum CGPA 8.5\""],
    angle: -56,
  },
  {
    id: "elig-beta",
    wave: 1,
    label: "Eligible · Beta",
    from: ["CGPA"],
    resolver: "rule",
    decision: "ask",
    before: "Eligible",
    after: "Question parked",
    reason: "Beta states its cutoff on a 4-point scale. The rule will not compare scales and the model is not asked to guess, so the student is asked.",
    evidence: ["CGPA v2 — 10-point scale", "Beta opening — \"minimum 3.2 / 4\""],
    angle: -19,
  },
  {
    id: "fit-acme",
    wave: 1,
    label: "Fit · Acme",
    from: ["CGPA", "Acme opening"],
    resolver: "model",
    decision: "update",
    before: "Medium",
    after: "High",
    reason: "No rule computes fit, so the model re-assessed it against the job-description lines it rests on; the answer passed schema validation before it was written.",
    evidence: ["CGPA v2", "Acme JD — the requirement lines cited by the fit"],
    angle: 19,
  },
  {
    id: "search",
    wave: 1,
    label: "Search criteria",
    from: ["CGPA"],
    resolver: "model",
    decision: "update",
    before: "Cutoffs up to 8.2",
    after: "Cutoffs up to 8.6",
    reason: "The criteria were derived from the old CGPA; the model rewrote them and the schema check accepted the result.",
    evidence: ["CGPA v2", "Search criteria v1"],
    angle: 56,
  },
  {
    id: "remind-acme",
    wave: 2,
    label: "Reminder · Acme",
    from: ["Eligible · Acme"],
    resolver: "rule",
    decision: "update",
    before: "Off — not eligible",
    after: "On — deadline tracked",
    reason: "A deadline reminder exists only for openings the student is eligible for; the rule turned it on when eligibility changed in wave 1.",
    evidence: ["Eligible · Acme — updated in wave 1", "Acme opening — application deadline"],
    angle: -34,
  },
  {
    id: "no-fit",
    wave: 2,
    label: "“No high-fit openings”",
    from: ["Fit · Acme"],
    resolver: "model",
    decision: "retire",
    before: "Held",
    after: "Retired",
    reason: "It rested on Acme's fit being medium. With the fit now high the belief no longer holds, so it is retired — kept in history, no longer served.",
    evidence: ["Fit · Acme — updated in wave 1"],
    angle: 6,
  },
  {
    id: "digest",
    wave: 2,
    label: "Digest scope",
    from: ["Search criteria"],
    resolver: "model",
    decision: "keep",
    before: "Follows search criteria",
    after: "Unchanged",
    reason: "The digest already follows whatever the search criteria are, so the new criteria need no change here.",
    evidence: ["Search criteria — updated in wave 1"],
    angle: 34,
  },
];

/** Steps of the play-through: statement, intake, wave 1, resolve 1, wave 2, resolve 2. */
const STEPS = ["Statement", "Intake", "Wave 1", "Resolve", "Wave 2", "Resolve"] as const;
const LAST = STEPS.length - 1;
const STEP_MS = 1150;

/* Geometry: the fact sits on the left; each wave is an ellipse travelling out from it. */
const VW = 560;
const VH = 330;
const FX = 46;
const FY = VH / 2;
const WAVES = { 1: { rx: 150, ry: 124 }, 2: { rx: 300, ry: 152 } } as const;
const r1 = (v: number) => Math.round(v * 10) / 10;

function at(belief: Belief): [number, number] {
  const { rx, ry } = WAVES[belief.wave];
  const a = (belief.angle * Math.PI) / 180;
  return [r1(FX + rx * Math.cos(a)), r1(FY + ry * Math.sin(a))];
}

const POSITION = new Map(BELIEFS.map((b) => [b.id, at(b)]));
const BY_LABEL = new Map(BELIEFS.map((b) => [b.label, b]));

const DECISION_STYLE: Record<Decision, string> = {
  update: "prog-ink-2",
  keep: "text-steel",
  retire: "text-faint line-through",
  ask: "text-bone",
};

const resolvedAt = (belief: Belief) => (belief.wave === 1 ? 3 : 5);
const reachedAt = (belief: Belief) => (belief.wave === 1 ? 2 : 4);

export function RippleFigure({ wide = false }: { wide?: boolean }) {
  const rootRef = useRef<HTMLElement>(null);
  const onScreen = useOnScreen(rootRef, 0.3);
  const reduced = useReducedMotion();
  const [step, setStep] = useState(0);
  const [selected, setSelected] = useState("elig-beta");
  const shown = reduced ? LAST : step;

  useEffect(() => {
    if (!onScreen || step >= LAST) return;
    const timer = window.setTimeout(() => setStep((s) => s + 1), step === 0 ? 700 : STEP_MS);
    return () => window.clearTimeout(timer);
  }, [onScreen, step]);

  const belief = BELIEFS.find((b) => b.id === selected)!;
  const resolved = shown >= resolvedAt(belief);
  const factChanged = shown >= 1;

  return (
    <figure ref={rootRef}>
      <div className="flex flex-wrap items-baseline justify-between gap-x-6 gap-y-2 pb-3">
        <p className="label text-steel">
          Statement <span className="text-bone normal-case tracking-normal">&ldquo;{FACT.statement}&rdquo;</span>
        </p>
        <div className="flex items-center gap-4">
          <p className="label text-faint" aria-live="polite">
            <span className="prog-ink">{String(shown + 1).padStart(2, "0")}</span> / {String(STEPS.length).padStart(2, "0")} ·{" "}
            {STEPS[shown]}
          </p>
          <button
            type="button"
            onClick={() => setStep(0)}
            disabled={reduced}
            className="label min-h-9 border border-rule-strong px-3 text-steel transition-colors duration-[var(--dur-fast)] hover:border-[rgb(var(--prog))] hover:text-bone disabled:opacity-40"
          >
            Replay
          </button>
        </div>
      </div>

      <div className={`grid gap-x-8 gap-y-6 ${wide ? "lg:grid-cols-[minmax(0,1.25fr)_minmax(0,1fr)]" : ""}`}>
        {/* The engine: deterministic traversal, drawn as waves. */}
        <div>
          <p className="label flex items-center justify-between gap-4 border-t border-rule-strong pt-2 text-faint">
            <span>
              <span className="prog-ink">Ripple engine</span> · graph traversal, no model call
            </span>
            <span className="hidden sm:inline">I3</span>
          </p>
          <svg
            viewBox={`0 0 ${VW} ${VH}`}
            className="mt-2 block h-auto w-full"
            role="img"
            aria-label="The changed CGPA fact on the left; wave 1 reaches four beliefs derived from it, wave 2 reaches three beliefs derived from those."
          >
            {/* The waves travel out from the fact. */}
            {([1, 2] as const).map((wave) => {
              const { rx, ry } = WAVES[wave];
              const on = shown >= (wave === 1 ? 2 : 4);
              return (
                <path
                  key={wave}
                  d={`M${FX} ${FY - ry}A${rx} ${ry} 0 0 1 ${FX} ${FY + ry}`}
                  fill="none"
                  stroke={`rgb(var(--prog) / ${on ? (wave === 1 ? 0.45 : 0.32) : 0})`}
                  strokeWidth={1}
                  strokeDasharray={wave === 2 ? "3 5" : undefined}
                  style={{
                    transformBox: "view-box",
                    transformOrigin: `${FX}px ${FY}px`,
                    transform: `scale(${on ? 1 : 0.15})`,
                    transition: reduced ? "none" : "transform 900ms cubic-bezier(0.2,0.7,0.2,1), stroke 600ms linear",
                  }}
                />
              );
            })}

            {/* Dependency links: each belief to what it was derived from. */}
            {BELIEFS.map((b) => {
              const [x, y] = POSITION.get(b.id)!;
              return b.from.map((source) => {
                const parent = BY_LABEL.get(source);
                if (!parent && source !== "CGPA") return null;
                const [px, py] = parent ? POSITION.get(parent.id)! : [FX, FY];
                const lit = shown >= reachedAt(b);
                return (
                  <line
                    key={`${b.id}-${source}`}
                    x1={px}
                    y1={py}
                    x2={x}
                    y2={y}
                    stroke={lit ? "rgb(var(--prog) / 0.55)" : "var(--color-rule-strong)"}
                    strokeWidth={1}
                    style={{ transition: "stroke 500ms linear" }}
                  />
                );
              });
            })}

            {/* The fact. */}
            <rect x={FX - 6} y={FY - 6} width={12} height={12} fill={factChanged ? "rgb(var(--prog-2))" : "rgb(var(--prog))"} />
            <text x={FX} y={FY - 16} textAnchor="middle" className="label" fill="var(--color-bone)">
              {FACT.label}
            </text>
            <text x={FX} y={FY + 24} textAnchor="middle" className="label" fill="var(--color-faint)">
              {factChanged ? FACT.after : FACT.before}
            </text>

            {/* Beliefs: reached, then decided. */}
            {BELIEFS.map((b) => {
              const [x, y] = POSITION.get(b.id)!;
              const reached = shown >= reachedAt(b);
              const done = shown >= resolvedAt(b);
              const isSelected = b.id === selected;
              const tone = !reached
                ? "var(--color-metal-3)"
                : done && b.decision === "update"
                  ? "rgb(var(--prog-2))"
                  : done && b.decision === "retire"
                    ? "var(--color-metal-2)"
                    : "rgb(var(--prog))";
              return (
                <g
                  key={b.id}
                  role="button"
                  tabIndex={0}
                  aria-pressed={isSelected}
                  aria-label={`${b.label}: ${done ? b.decision : reached ? "being resolved" : "not reached yet"}. Show why.`}
                  onClick={() => setSelected(b.id)}
                  onKeyDown={(event) => {
                    if (event.key === "Enter" || event.key === " ") {
                      event.preventDefault();
                      setSelected(b.id);
                    }
                  }}
                  className="cursor-pointer outline-none [&:focus-visible>rect:first-child]:stroke-[var(--color-signal)]"
                >
                  <rect x={x - 12} y={y - 12} width={150} height={24} fill="transparent" stroke="transparent" />
                  {isSelected && <rect x={x - 7} y={y - 7} width={14} height={14} fill="none" stroke="var(--color-bone)" strokeWidth={1} />}
                  {b.decision === "ask" && done ? (
                    <rect x={x - 4} y={y - 4} width={8} height={8} fill="var(--color-carbon)" stroke="rgb(var(--prog))" strokeDasharray="2 2" />
                  ) : (
                    <rect x={x - 4} y={y - 4} width={8} height={8} fill={tone} style={{ transition: "fill 400ms linear" }} />
                  )}
                  {/* A halo in the page colour keeps labels legible where a link passes under them. */}
                  <g className="max-sm:hidden" stroke="var(--color-carbon)" strokeWidth={4} paintOrder="stroke" strokeLinejoin="round">
                    <text
                      x={x + 12}
                      y={y - 2}
                      fontSize={12}
                      fill={reached ? "var(--color-bone)" : "var(--color-faint)"}
                      textDecoration={done && b.decision === "retire" ? "line-through" : undefined}
                    >
                      {b.label}
                    </text>
                    <text x={x + 12} y={y + 11} className="label" fill={done ? "var(--color-steel)" : "var(--color-metal-3)"}>
                      {done ? `${b.decision} · ${b.resolver === "rule" ? "rule" : "model"}` : `wave ${b.wave}`}
                    </text>
                  </g>
                </g>
              );
            })}
          </svg>
        </div>

        {/* The resolver chain, and the provenance of the selected belief. */}
        <div className="grid content-start gap-y-6">
          <div>
            <p className="label flex items-center justify-between gap-4 border-t border-rule-strong pt-2 text-faint">
              <span>
                <span className="prog-ink">Resolver chain</span> · rules first, model second
              </span>
              <span className="hidden sm:inline">I4</span>
            </p>
            <ol className="mt-1" aria-label="Decisions per belief">
              {BELIEFS.map((b) => {
                const done = shown >= resolvedAt(b);
                const on = b.id === selected;
                return (
                  <li key={b.id}>
                    <button
                      type="button"
                      aria-pressed={on}
                      onClick={() => setSelected(b.id)}
                      className={`grid w-full grid-cols-[2.25rem_minmax(0,1fr)_4.25rem_4rem] items-baseline gap-x-2 border-b border-rule py-1.5 text-left transition-colors duration-[var(--dur-fast)] ${
                        on ? "text-bone" : "text-steel hover:text-bone"
                      }`}
                    >
                      <span className="label text-faint">W{b.wave}</span>
                      <span className="truncate text-[0.875rem]">
                        {on && <span aria-hidden="true" className="prog-bg mr-2 inline-block h-px w-2.5 align-middle" />}
                        {b.label}
                      </span>
                      <span className={`label ${b.resolver === "rule" ? "text-steel" : "prog-ink"}`}>
                        {b.resolver === "rule" ? "Rule" : "Model"}
                      </span>
                      <span className={`label text-right ${done ? DECISION_STYLE[b.decision] : "text-metal-3"}`}>
                        {done ? b.decision : "—"}
                      </span>
                    </button>
                  </li>
                );
              })}
            </ol>
          </div>

          <div aria-live="polite">
            <p className="label border-t border-[rgb(var(--prog)/0.55)] pt-2 text-faint">
              Why do you believe this? <span className="text-metal-3">· audit record, I2</span>
            </p>
            <p className="mt-3 text-[0.9875rem] text-bone">{belief.label}</p>
            <p className="mt-1 text-[0.875rem] text-steel">
              {belief.before}
              <span aria-hidden="true" className="mx-2 text-faint">
                →
              </span>
              <span className={resolved ? DECISION_STYLE[belief.decision] : "text-faint"}>
                {resolved ? belief.after : "not decided yet"}
              </span>
            </p>
            <dl className="mt-3 grid grid-cols-[5.5rem_minmax(0,1fr)] gap-x-3 gap-y-1.5 text-[0.8125rem] leading-snug">
              <dt className="label pt-0.5 text-faint">Derived from</dt>
              <dd className="text-steel">{belief.from.join(", ")}</dd>
              <dt className="label pt-0.5 text-faint">Decided by</dt>
              <dd className="text-steel">
                {belief.resolver === "rule" ? "Domain rule — computed" : "Model fallback — schema-validated"}
              </dd>
              <dt className="label pt-0.5 text-faint">Reason</dt>
              <dd className="text-steel">{resolved ? belief.reason : "Waiting for its wave to be resolved."}</dd>
              <dt className="label pt-0.5 text-faint">Evidence</dt>
              <dd className="text-steel">{belief.evidence.join(" · ")}</dd>
            </dl>
          </div>
        </div>
      </div>
    </figure>
  );
}
