"use client";

import { useEffect, useRef, useState } from "react";
import { useOnScreen, useReducedMotion } from "./_shared/a-shared";

/**
 * Inside the Transformers — the textbook induction-circuit hypothesis, and what ablation tests.
 *
 * A two-layer attention-only model (the README's principal research model) drawn as a
 * layers × heads grid. The hypothesis path runs embed → a layer-0 previous-token head → (key
 * composition) → a layer-1 induction head → the logits, and the token strip beside it shows
 * what those two heads are hypothesised to attend to on "… A B … A → B". Any head can be
 * ablated: ablate one on the path and the path breaks; ablate one off it and, under the
 * hypothesis, nothing changes. That is the prediction an ablation experiment tests.
 *
 * Schematic throughout: four heads per layer and the head indices are ours. The README's
 * reported finding is that this textbook account was partly wrong, and the figure says so.
 * While on screen, a signal steps along the path; under reduced motion the path is simply lit.
 */

const PATH_INK = "rgb(var(--prog, 244 114 182))";
const KEY_INK = "rgb(var(--prog-2, 167 139 250))";
const STEP_MS = 850;

const LAYERS = 2;
const HEADS = 4;
const PREV = { layer: 0, head: 1 };
const INDUCTION = { layer: 1, head: 2 };

const key = (layer: number, head: number) => `L${layer}H${head}`;
const PREV_KEY = key(PREV.layer, PREV.head);
const INDUCTION_KEY = key(INDUCTION.layer, INDUCTION.head);

// Circuit geometry, in percent of the drawing box (the overlay uses the same 0–100 space).
const X = (head: number) => 34 + head * 18.5;
const ROW_Y = { logits: 9, l1: 38, l0: 66, embed: 92 } as const;
const layerY = (layer: number) => (layer === 1 ? ROW_Y.l1 : ROW_Y.l0);

const TOKENS = ["x", "A", "B", "y", "z", "A"];

export function HeadCircuitFigure({ wide = false }: { wide?: boolean }) {
  const rootRef = useRef<HTMLDivElement>(null);
  const onScreen = useOnScreen(rootRef);
  const reduced = useReducedMotion();
  const [ablated, setAblated] = useState<Set<string>>(() => new Set());
  const [phase, setPhase] = useState(4);

  useEffect(() => {
    if (!onScreen) return;
    const timer = window.setInterval(() => setPhase((p) => (p + 1) % 6), STEP_MS);
    return () => window.clearInterval(timer);
  }, [onScreen]);

  const prevOut = ablated.has(PREV_KEY);
  const inductionOut = ablated.has(INDUCTION_KEY);
  const broken = prevOut || inductionOut;
  // A segment is intact if every head before it on the path is still there.
  const intact = [true, !prevOut, !prevOut && !inductionOut];
  // While moving, a segment is lit once the signal has reached it; when still, all intact ones.
  const lit = (segment: number) => intact[segment] && (reduced || !onScreen || phase > segment);
  const predicted = !broken && (reduced || !onScreen || phase >= 3);

  const toggle = (id: string) =>
    setAblated((current) => {
      const next = new Set(current);
      if (next.has(id)) next.delete(id);
      else next.add(id);
      return next;
    });

  const segment = (index: number, x1: number, y1: number, x2: number, y2: number, ink: string) => (
    <line
      x1={x1}
      y1={y1}
      x2={x2}
      y2={y2}
      stroke={intact[index] ? ink : "var(--color-metal-3)"}
      strokeOpacity={intact[index] ? (lit(index) ? 1 : 0.3) : 0.8}
      strokeWidth={intact[index] ? 1.75 : 1}
      strokeDasharray={intact[index] ? undefined : "3 4"}
      vectorEffect="non-scaling-stroke"
      className="transition-[stroke-opacity] duration-[var(--dur-base)]"
    />
  );

  const status = broken
    ? `${[prevOut && PREV_KEY, inductionOut && INDUCTION_KEY].filter(Boolean).join(" and ")} ablated — the hypothesised path is broken, so it predicts the copy fails.`
    : ablated.size > 0
      ? `${[...ablated].join(", ")} ablated — off the hypothesised path, so it predicts no change.`
      : "No heads ablated. Select a head to ablate it.";

  // Token strip geometry (SVG units).
  const TW = 340;
  const tx = (i: number) => 20 + i * 48;
  const TY = 62;
  const arc = (from: number, to: number, lift: number) =>
    `M${tx(from)} ${TY - 13}C${tx(from)} ${TY - 13 - lift} ${tx(to)} ${TY - 13 - lift} ${tx(to)} ${TY - 13}`;

  return (
    <div ref={rootRef}>
      <div className="flex flex-wrap items-baseline justify-between gap-x-6 gap-y-1 pb-4">
        <p className="label text-steel">
          Two layers, attention only <span className="text-faint">— the induction hypothesis</span>
        </p>
        <p className="label text-faint">Schematic — head count and indices illustrative</p>
      </div>

      <div className={`grid gap-x-8 gap-y-6 ${wide ? "md:grid-cols-[minmax(0,1.15fr)_minmax(0,1fr)]" : "sm:grid-cols-[minmax(0,1.1fr)_minmax(0,1fr)]"}`}>
        {/* Layers × heads, with the hypothesised path drawn through them. */}
        <div>
          <p id="circuit-heads" className="label pb-2 text-steel">
            Select a head to ablate it
          </p>
          <div role="group" aria-labelledby="circuit-heads" className="relative h-[17rem] sm:h-[19rem]">
            <svg viewBox="0 0 100 100" preserveAspectRatio="none" aria-hidden="true" className="absolute inset-0 h-full w-full overflow-visible">
              {/* Layer rules. */}
              {[ROW_Y.l1, ROW_Y.l0].map((y) => (
                <line key={y} x1={10} x2={100} y1={y} y2={y} stroke="var(--color-rule)" vectorEffect="non-scaling-stroke" />
              ))}
              {segment(0, X(PREV.head), ROW_Y.embed - 4, X(PREV.head), ROW_Y.l0 + 7, PATH_INK)}
              {segment(1, X(PREV.head), ROW_Y.l0 - 7, X(INDUCTION.head), ROW_Y.l1 + 7, KEY_INK)}
              {segment(2, X(INDUCTION.head), ROW_Y.l1 - 7, X(INDUCTION.head), ROW_Y.logits + 4, PATH_INK)}
            </svg>

            {/* Row labels. */}
            {(
              [
                ["Logits", ROW_Y.logits],
                ["Layer 1", ROW_Y.l1],
                ["Layer 0", ROW_Y.l0],
                ["Embed", ROW_Y.embed],
              ] as const
            ).map(([name, y]) => (
              <span key={name} className="label absolute left-0 -translate-y-1/2 text-faint" style={{ top: `${y}%` }}>
                {name}
              </span>
            ))}

            {/* The ends of the path. */}
            <span
              className="readout absolute -translate-x-1/2 -translate-y-1/2 border px-2 py-0.5 text-[0.75rem] transition-colors duration-[var(--dur-base)]"
              style={{
                left: `${X(INDUCTION.head)}%`,
                top: `${ROW_Y.logits}%`,
                borderColor: predicted ? PATH_INK : "var(--color-rule-strong)",
                color: predicted ? PATH_INK : "var(--color-faint)",
              }}
            >
              {broken ? "next: ?" : "next: B"}
            </span>
            <span
              className="readout absolute -translate-x-1/2 -translate-y-1/2 border border-rule-strong px-2 py-0.5 text-[0.75rem] text-steel"
              style={{ left: `${X(PREV.head)}%`, top: `${ROW_Y.embed}%` }}
            >
              tokens
            </span>
            <span
              className="label absolute -translate-y-1/2 whitespace-nowrap pr-2 transition-colors duration-[var(--dur-base)]"
              style={{
                right: `${100 - (X(PREV.head) + X(INDUCTION.head)) / 2 + 1}%`,
                top: `${(ROW_Y.l0 + ROW_Y.l1) / 2}%`,
                color: intact[1] ? KEY_INK : "var(--color-faint)",
              }}
            >
              K-composition
            </span>

            {/* The heads. */}
            {Array.from({ length: LAYERS }, (_, layer) =>
              Array.from({ length: HEADS }, (_, head) => {
                const id = key(layer, head);
                const out = ablated.has(id);
                const role = id === PREV_KEY ? "previous-token" : id === INDUCTION_KEY ? "induction" : null;
                return (
                  <button
                    key={id}
                    type="button"
                    aria-pressed={out}
                    aria-label={`${out ? "Restore" : "Ablate"} ${id}${role ? `, the hypothesised ${role} head` : ""}`}
                    onClick={() => toggle(id)}
                    className="readout absolute flex size-10 -translate-x-1/2 -translate-y-1/2 flex-col items-center justify-center border text-[0.6875rem] transition-colors duration-[var(--dur-fast)] ease-[var(--ease-snap)] hover:text-bone sm:size-11"
                    style={{
                      left: `${X(head)}%`,
                      top: `${layerY(layer)}%`,
                      color: out ? "var(--color-faint)" : role ? PATH_INK : "var(--color-steel)",
                      borderColor: out ? "var(--color-metal-2)" : role ? PATH_INK : "var(--color-rule-strong)",
                      background: out
                        ? "repeating-linear-gradient(45deg, var(--color-metal) 0 1px, var(--color-carbon) 1px 5px)"
                        : role
                          ? `rgb(var(--prog, 244 114 182) / 0.1)`
                          : "var(--color-carbon)",
                    }}
                  >
                    <span className={out ? "line-through" : undefined}>{id}</span>
                    {out && <span className="label text-[0.5625rem]">off</span>}
                  </button>
                );
              }),
            )}
          </div>
          <p className="label mt-3 flex flex-wrap gap-x-4 gap-y-1 text-faint" aria-hidden="true">
            <span style={{ color: PATH_INK }}>
              {PREV_KEY} previous-token · {INDUCTION_KEY} induction
            </span>
            <span>Hypothesised roles</span>
          </p>
        </div>

        {/* What the two heads are hypothesised to do, on one sequence. */}
        <div className="flex min-w-0 flex-col">
          <p className="label pb-2 text-steel">On “x A B y z A”, predict B</p>
          <svg
            viewBox={`0 0 ${TW} 96`}
            className="block h-auto w-full max-w-[26rem]"
            role="img"
            aria-label={
              broken
                ? "Token strip x A B y z A. With the path broken, the induction head cannot find the token that followed the earlier A, and the copy fails."
                : "Token strip x A B y z A. The previous-token head at B attends to the A before it; the induction head at the final A attends to B, the token that followed the earlier A, and copies it as the prediction."
            }
          >
            {/* Previous-token head: B looks back one place. */}
            <path
              d={arc(2, 1, 22)}
              fill="none"
              stroke={prevOut ? "var(--color-metal-3)" : PATH_INK}
              strokeDasharray={prevOut ? "3 4" : undefined}
              strokeWidth={1.25}
              vectorEffect="non-scaling-stroke"
            />
            {/* Induction head: the final A finds what followed the earlier A. */}
            <path
              d={arc(5, 2, 44)}
              fill="none"
              stroke={broken ? "var(--color-metal-3)" : KEY_INK}
              strokeDasharray={broken ? "3 4" : undefined}
              strokeWidth={1.25}
              vectorEffect="non-scaling-stroke"
            />
            <text x={(tx(1) + tx(2)) / 2} y={TY - 38} textAnchor="middle" fontSize={11} className="font-mono" fill={prevOut ? "var(--color-faint)" : PATH_INK}>
              {PREV_KEY}
            </text>
            <text x={(tx(2) + tx(5)) / 2} y={TY - 52} textAnchor="middle" fontSize={11} className="font-mono" fill={broken ? "var(--color-faint)" : KEY_INK}>
              {INDUCTION_KEY}
            </text>

            {TOKENS.map((token, i) => {
              const strong = i === 1 || i === 2 || i === 5;
              return (
                <g key={i}>
                  <rect
                    x={tx(i) - 17}
                    y={TY - 13}
                    width={34}
                    height={26}
                    fill="var(--color-carbon)"
                    stroke={strong ? "var(--color-bone)" : "var(--color-rule-strong)"}
                    strokeOpacity={strong ? 0.7 : 1}
                    vectorEffect="non-scaling-stroke"
                  />
                  <text x={tx(i)} y={TY + 5} textAnchor="middle" fontSize={15} className="font-mono" fill={strong ? "var(--color-bone)" : "var(--color-faint)"}>
                    {token}
                  </text>
                  <text x={tx(i)} y={TY + 29} textAnchor="middle" fontSize={9} className="font-mono" fill="var(--color-faint)">
                    {i}
                  </text>
                </g>
              );
            })}
            <text x={tx(5) + 24} y={TY + 5} fontSize={15} className="font-mono" fill={predicted ? PATH_INK : "var(--color-faint)"}>
              → {broken ? "?" : "B"}
            </text>
          </svg>

          <p className="mt-3 min-h-[2.75rem] text-[0.875rem] leading-snug text-bone" aria-live="polite">
            {status}
          </p>

          <div className="mt-auto border-t border-rule pt-3">
            <p className="label pb-1.5 text-faint">Reported in the README</p>
            <p className="text-[0.8125rem] leading-snug text-steel">
              The preregistered textbook hypothesis was partly wrong: no sharp previous-token head emerged, and the
              learned circuit was distributed across a group of layer-1 heads, dominated by key composition.
            </p>
            {ablated.size > 0 && (
              <button
                type="button"
                onClick={() => setAblated(new Set())}
                className="label mt-3 min-h-9 border border-rule-strong px-3 text-steel transition-colors duration-[var(--dur-fast)] hover:text-bone"
              >
                Restore all heads
              </button>
            )}
          </div>
        </div>
      </div>
    </div>
  );
}

export const CAPTION =
  "The induction-circuit hypothesis in a two-layer, attention-only model: a previous-token head feeding an induction head through key composition. Ablate any head to see what the hypothesis predicts. Schematic — head count and indices are illustrative; the README reports that this textbook account was partly wrong.";
