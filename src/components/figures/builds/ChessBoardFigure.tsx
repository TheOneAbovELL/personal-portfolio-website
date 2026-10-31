"use client";

import { useEffect, useRef, useState, type KeyboardEvent } from "react";
import { prefersReducedMotion } from "@/lib/motion";
import { FINISH, coords, parseBoard, BEFORE_FINISH_FEN, type Square } from "./_shared/b-immortal";

/**
 * ChessLab — an analysis board on the owner's favourite position: the finish of the Immortal
 * Game (Anderssen v Kieseritzky, London 1851), from 21.Nxg7+ to 23.Be7#.
 *
 * Positions are derived by applying the game's moves; the last one is the published FEN of
 * the mate. The status line under the board states only what can be read off the position
 * (checks, forced replies, mate) — there is no engine output here. Step with the controls,
 * the move list or the arrow keys; "Replay" plays the finish once while the board is on screen.
 */

export const CAPTION =
  "The finish of the Immortal Game (Anderssen v Kieseritzky, 1851) on an analysis board: last-move arrow, evaluation bar, move list. The moves are the game's and the mate is forced from the first position; nothing here is engine output.";

const S = 40;
const BOARD = S * 8;
const STEP_MS = 1100;

/** What can be read off each position (0 = before 21.Nxg7+). Checked by hand against the board. */
const STATUS = [
  "White to move — mate is forced",
  "Check — Kd8 is Black's only move",
  "White to move — mate is forced",
  "Check — Nxf6 or Ne7, both lose",
  "Be7 is mate",
  "Checkmate · 1–0",
];

/* Piece glyphs, drawn in a 40 × 40 square: plain silhouettes in the site's line language. */
const BASE = "M11 32H29V35.5H11Z";
const GLYPHS: Record<string, string[]> = {
  p: ["M20 8.5a5 5 0 1 1 0 10a5 5 0 1 1 0-10Z", "M14 31.5C14 25 16.5 21.5 20 19.5C23.5 21.5 26 25 26 31.5Z", BASE],
  r: ["M12 31.5H28L26.5 18H28.5V10.5H25V13.5H22V10.5H18V13.5H15V10.5H11.5V18H13.5Z", BASE],
  n: ["M13.5 31.5H28.5C29 24 27.5 15 21.5 10.5L20.5 7L17.5 10C13.5 12 11 16.5 10 20.5L12 23L16.5 21C17.5 22.5 17 24.5 15 26.5C13.5 28 13.5 30 13.5 31.5Z", BASE],
  b: ["M14 31.5C13 24.5 15.5 17.5 20 12.5C24.5 17.5 27 24.5 26 31.5Z", "M20 6.5a2.6 2.6 0 1 1 0 5.2a2.6 2.6 0 1 1 0-5.2Z", BASE],
  q: ["M12.5 31.5L10 14.5L15.5 22L17.5 11.5L20 21L22.5 11.5L24.5 22L30 14.5L27.5 31.5Z", BASE],
  k: ["M12.5 31.5C10.5 24 14 19.5 20 21.5C26 19.5 29.5 24 27.5 31.5Z", "M18.8 6.5H21.2V9.5H24V11.8H21.2V18.5H18.8V11.8H16V9.5H18.8Z", BASE],
};
/** The knight's eye: a dot, so the head reads at small sizes. */
const KNIGHT_EYE = { cx: 18.5, cy: 14.5, r: 1.1 };

function Piece({ piece }: { piece: string }) {
  const white = piece === piece.toUpperCase();
  const kind = piece.toLowerCase();
  return (
    <>
      {GLYPHS[kind].map((d) => (
        <path
          key={d}
          d={d}
          fill={white ? "rgb(var(--prog))" : "var(--color-carbon)"}
          stroke={white ? "var(--color-carbon)" : "rgb(var(--prog) / 0.9)"}
          strokeWidth={1.2}
          strokeLinejoin="round"
        />
      ))}
      {kind === "n" && <circle {...KNIGHT_EYE} fill={white ? "var(--color-carbon)" : "rgb(var(--prog) / 0.9)"} />}
    </>
  );
}

interface Placed {
  id: string;
  piece: string;
  square: Square;
}

/** Every position with stable piece identities, so a moving piece glides rather than reappears. */
function buildPositions(): Placed[][] {
  const start: Placed[] = [...parseBoard(BEFORE_FINISH_FEN)].map(([square, piece]) => ({ id: square, piece, square }));
  const positions = [start];
  for (const ply of FINISH) {
    const previous = positions[positions.length - 1];
    positions.push(
      previous
        .filter((p) => p.square !== ply.to)
        .map((p) => (p.square === ply.from ? { ...p, square: ply.to } : p)),
    );
  }
  return positions;
}

const POSITIONS = buildPositions();

const centre = (square: Square) => {
  const [file, rank] = coords(square);
  return [file * S + S / 2, (7 - rank) * S + S / 2] as const;
};

function MoveArrow({ from, to }: { from: Square; to: Square }) {
  const [x1, y1] = centre(from);
  const [x2, y2] = centre(to);
  const df = Math.abs(x2 - x1) / S;
  const dr = Math.abs(y2 - y1) / S;
  const knight = (df === 1 && dr === 2) || (df === 2 && dr === 1);
  const corner = knight ? (dr === 2 ? [x1, y2] : [x2, y1]) : null;
  const [lx, ly] = corner ?? [x1, y1];
  const length = Math.hypot(x2 - lx, y2 - ly);
  const ux = (x2 - lx) / length;
  const uy = (y2 - ly) / length;
  const head = 13;
  const bx = x2 - ux * head;
  const by = y2 - uy * head;
  const r = (v: number) => v.toFixed(2);
  const points = corner ? `${x1},${y1} ${corner[0]},${corner[1]} ${r(bx)},${r(by)}` : `${x1},${y1} ${r(bx)},${r(by)}`;
  return (
    <g opacity={0.85} pointerEvents="none">
      <polyline points={points} fill="none" stroke="rgb(var(--prog-2))" strokeWidth={6} strokeLinejoin="round" strokeLinecap="round" />
      <path d={`M${x2} ${y2}L${r(bx - uy * 9)} ${r(by + ux * 9)}L${r(bx + uy * 9)} ${r(by - ux * 9)}Z`} fill="rgb(var(--prog-2))" />
    </g>
  );
}

export function ChessBoardFigure({ wide = false }: { wide?: boolean }) {
  const positions = POSITIONS;
  const last = positions.length - 1;
  const [step, setStep] = useState(last);
  const [replaying, setReplaying] = useState(false);
  const [visible, setVisible] = useState(false);
  const rootRef = useRef<HTMLElement>(null);

  useEffect(() => {
    const root = rootRef.current;
    if (!root) return;
    const observer = new IntersectionObserver(([entry]) => setVisible(entry.isIntersecting), { threshold: 0.3 });
    observer.observe(root);
    return () => observer.disconnect();
  }, []);

  // Replay steps through the finish once, and only while the board is on screen.
  useEffect(() => {
    if (!replaying || !visible) return;
    const timer = window.setInterval(() => {
      setStep((s) => {
        if (s >= last) {
          setReplaying(false);
          return s;
        }
        return s + 1;
      });
    }, prefersReducedMotion() ? STEP_MS * 1.6 : STEP_MS);
    return () => window.clearInterval(timer);
  }, [replaying, visible, last]);

  const go = (next: number) => {
    setReplaying(false);
    setStep(Math.max(0, Math.min(last, next)));
  };
  const onKeyDown = (event: KeyboardEvent) => {
    const moves: Record<string, number> = { ArrowLeft: step - 1, ArrowRight: step + 1, Home: 0, End: last };
    if (event.key in moves) {
      event.preventDefault();
      go(moves[event.key]);
    }
  };

  const ply = step > 0 ? FINISH[step - 1] : null;
  const placed = positions[step];
  const checked = ply?.san.includes("+") || ply?.san.includes("#");
  const blackKing = placed.find((p) => p.piece === "k")!;
  const mate = step === last;

  const controls = [
    { label: "First position", glyph: "M5 4v12M16 4l-8 6 8 6z", to: 0, disabled: step === 0 },
    { label: "Previous move", glyph: "M14 4l-8 6 8 6z", to: step - 1, disabled: step === 0 },
    { label: "Next move", glyph: "M6 4l8 6-8 6z", to: step + 1, disabled: step === last },
    { label: "Last position", glyph: "M15 4v12M4 4l8 6-8 6z", to: last, disabled: step === last },
  ];

  return (
    <figure ref={rootRef} onKeyDown={onKeyDown}>
      <div className="flex flex-wrap items-baseline justify-between gap-x-6 gap-y-1 pb-3">
        <p className="label text-steel">
          Anderssen v Kieseritzky <span className="text-faint">— London 1851</span>
        </p>
        <p className="label text-faint">Game moves — no engine output</p>
      </div>

      <div className={`grid gap-x-8 gap-y-5 ${wide ? "md:grid-cols-[minmax(0,26rem)_minmax(0,1fr)]" : ""}`}>
        <div className="flex w-full max-w-[26rem] gap-3">
          {/* Evaluation bar: White's share, from the bottom. Every position here is lost for Black. */}
          <div className="flex w-5 shrink-0 flex-col items-center gap-1.5" aria-hidden="true">
            <span className="label text-[0.625rem] text-bone">{mate ? "#" : "M"}</span>
            <div className="relative w-full flex-1 border border-rule-strong bg-carbon">
              <div className="absolute inset-x-0 bottom-0 h-full" style={{ backgroundColor: "rgb(var(--prog))" }} />
              <div className="absolute inset-x-0 top-1/2 h-px bg-[var(--color-metal-3)]" />
            </div>
            <span className="label text-[0.625rem] text-faint">Mate</span>
          </div>

          <svg
            viewBox={`0 0 ${BOARD} ${BOARD}`}
            className="block h-auto w-full min-w-0 border border-rule-strong"
            role="img"
            aria-label={`Chess board after ${ply ? `${ply.number}${ply.san}` : "20…Na6"}: ${STATUS[step]}. Position ${step + 1} of ${positions.length}.`}
          >
            {Array.from({ length: 64 }, (_, i) => {
              const file = i % 8;
              const row = Math.floor(i / 8);
              const light = (file + row) % 2 === 0;
              const name = `${String.fromCharCode(97 + file)}${8 - row}` as Square;
              const touched = ply && (ply.from === name || ply.to === name);
              return (
                <g key={name}>
                  <rect
                    x={file * S}
                    y={row * S}
                    width={S}
                    height={S}
                    fill={light ? "rgb(var(--prog) / 0.15)" : "rgb(var(--prog) / 0.04)"}
                  />
                  {touched && <rect x={file * S} y={row * S} width={S} height={S} fill="rgb(var(--prog-2) / 0.2)" />}
                  {file === 0 && (
                    <text x={3} y={row * S + 9} fontSize={7} className="font-mono" fill="var(--color-faint)">
                      {8 - row}
                    </text>
                  )}
                  {row === 7 && (
                    <text x={file * S + S - 3} y={BOARD - 3} fontSize={7} textAnchor="end" className="font-mono" fill="var(--color-faint)">
                      {String.fromCharCode(97 + file)}
                    </text>
                  )}
                </g>
              );
            })}

            {/* The king in check, ringed; at mate, in performance red. */}
            {checked && (
              <rect
                x={centre(blackKing.square)[0] - S / 2 + 1.5}
                y={centre(blackKing.square)[1] - S / 2 + 1.5}
                width={S - 3}
                height={S - 3}
                fill="none"
                stroke={mate ? "var(--color-perf-bright)" : "rgb(var(--prog-2))"}
                strokeWidth={2}
              />
            )}

            {placed.map((p) => {
              const [cx, cy] = centre(p.square);
              return (
                <g
                  key={p.id}
                  className="motion-safe:transition-transform motion-safe:duration-[var(--dur-base)] motion-safe:ease-[var(--ease-out)]"
                  style={{ transform: `translate(${cx - S / 2}px, ${cy - S / 2}px)` }}
                >
                  <Piece piece={p.piece} />
                </g>
              );
            })}

            {ply && <MoveArrow key={step} from={ply.from} to={ply.to} />}
          </svg>
        </div>

        <div className="flex min-w-0 flex-col">
          <p className="readout border-t border-rule pt-3 text-[1.0625rem] text-bone" aria-live="polite">
            {ply ? (
              <>
                <span className="text-faint">{ply.number}</span>
                {ply.san}
              </>
            ) : (
              <span className="text-faint">20…Na6</span>
            )}
            <span className="label ml-3 align-middle text-steel">{STATUS[step]}</span>
          </p>

          <ol className="mt-4 grid grid-cols-[2.5rem_1fr_1fr] border-t border-rule" aria-label="Moves of the finish">
            {[0, 1, 2].map((pair) => {
              const whiteIndex = pair * 2 + 1;
              return (
                <li key={pair} className="contents">
                  <span className="label border-b border-rule py-2 text-faint">{21 + pair}.</span>
                  {[whiteIndex, whiteIndex + 1].map((index) =>
                    index <= last ? (
                      <button
                        key={index}
                        type="button"
                        aria-current={index === step ? "step" : undefined}
                        onClick={() => go(index)}
                        className={`readout min-h-9 border-b border-rule px-2 text-left text-[0.9375rem] transition-colors duration-[var(--dur-fast)] ${
                          index === step ? "prog-ink-2" : "text-steel hover:text-bone"
                        }`}
                      >
                        {FINISH[index - 1].san}
                      </button>
                    ) : (
                      <span key={index} className="border-b border-rule" />
                    ),
                  )}
                </li>
              );
            })}
          </ol>

          <div className="mt-4 flex flex-wrap items-center gap-2">
            <div role="group" aria-label="Step through the moves" className="flex">
              {controls.map((c) => (
                <button
                  key={c.label}
                  type="button"
                  aria-label={c.label}
                  disabled={c.disabled}
                  onClick={() => go(c.to)}
                  className="-ml-px grid size-9 place-items-center border border-rule-strong text-steel transition-colors duration-[var(--dur-fast)] first:ml-0 hover:text-bone disabled:text-[var(--color-metal-3)] disabled:hover:text-[var(--color-metal-3)]"
                >
                  <svg viewBox="0 0 20 20" className="size-3.5" aria-hidden="true">
                    <path d={c.glyph} fill="currentColor" stroke="currentColor" strokeWidth={1.4} strokeLinejoin="round" />
                  </svg>
                </button>
              ))}
            </div>
            <button
              type="button"
              aria-pressed={replaying}
              onClick={() => {
                if (replaying) return setReplaying(false);
                setStep(0);
                setReplaying(true);
              }}
              className={`label min-h-9 border px-3 transition-colors duration-[var(--dur-fast)] ${
                replaying ? "border-[rgb(var(--prog-2))] text-[rgb(var(--prog-2))]" : "border-rule-strong text-steel hover:text-bone"
              }`}
            >
              {replaying ? "Stop" : "Replay finish"}
            </button>
          </div>
          <p className="label mt-3 text-faint">← → to step</p>
        </div>
      </div>
    </figure>
  );
}
