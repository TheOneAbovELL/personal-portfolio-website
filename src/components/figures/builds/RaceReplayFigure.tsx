"use client";

import { useEffect, useRef, useState } from "react";
import { prefersReducedMotion } from "@/lib/motion";
import { circuit, circuitAt, circuitCurvature } from "./_shared/b-circuit";

/**
 * F1 Replay Dashboard — what the dashboard does, on made-up data: an outline built from
 * location samples, cars replayed around it at their own pace, and a timing tower that
 * re-orders as they pass. The circuit is a deterministic parametric curve (not a real track)
 * and the cars, codes and gaps are generated; nothing here is race data.
 *
 * The motion is the replay itself, running only while the figure is on screen; play/pause
 * and the scrubber are the controls. Reduced motion holds a mid-race frame until played.
 */

export const CAPTION =
  "Schematic replay — not race data. A generated circuit outline, eight generated cars and a timing tower that re-orders as they pass; the real dashboard derives its outline from OpenF1 location samples and streams state over Socket.IO.";

const CARS = 8;
const LAPS = 5;
/** Replay seconds per real second. */
const SPEED = 9;
const BASE_LAP = 84;
const START_AT = 128;

/** Seed in [0, 1) per index — the same cars on every render. */
const seed = (n: number) => {
  const s = Math.sin(n * 91.7 + 47.3) * 43758.5453;
  return s - Math.floor(s);
};

const CODES = Array.from({ length: CARS }, (_, i) => `C${String(i + 1).padStart(2, "0")}`);
// Pace is not grid order: quicker cars start further back, so the order changes as it runs.
const LAP_TIME = CODES.map((_, i) => BASE_LAP + 3.2 * seed(i + 7));
const PHASE = CODES.map((_, i) => seed(i + 20) * Math.PI * 2);

/* Time → distance along a lap: cars are slower where the outline is tight. */
const TABLE = 600;
function buildPace(): Float32Array {
  const time = new Float32Array(TABLE + 1);
  for (let k = 1; k <= TABLE; k++) {
    const u = (k - 0.5) / TABLE;
    time[k] = time[k - 1] + 1 / (1 - 0.55 * circuitCurvature(u));
  }
  // Inverse: for a share of lap time, the share of lap distance.
  const distance = new Float32Array(TABLE + 1);
  let j = 0;
  for (let k = 0; k <= TABLE; k++) {
    const target = (k / TABLE) * time[TABLE];
    while (j < TABLE && time[j + 1] < target) j++;
    const f = (target - time[j]) / (time[j + 1] - time[j] || 1);
    distance[k] = Math.min(1, (j + f) / TABLE);
  }
  return distance;
}

const PACE = buildPace();

/** Laps completed (fractional) by car `i` at replay time `t`: its own pace, a slow wave of form, a grid slot. */
const laps = (i: number, t: number) =>
  t / LAP_TIME[i] + 0.012 * Math.sin((2 * Math.PI * t) / (BASE_LAP * 2.3) + PHASE[i]) - 0.022 * i;

const DURATION = BASE_LAP * LAPS;

const clock = (t: number) => {
  const m = Math.floor(t / 60);
  const s = t - m * 60;
  return `${String(m).padStart(2, "0")}:${s.toFixed(1).padStart(4, "0")}`;
};

/* Drawing box: fixed, because the outline is. */
const PAD = 14;
const VW = 420;
const VH = Math.round((VW - PAD * 2) / circuit().aspect + PAD * 2);
/** Rounded to a hundredth, so server and client agree on every attribute despite float noise. */
const r2 = (v: number) => Math.round(v * 100) / 100;
const toView = ([x, y]: readonly [number, number]) => [r2(PAD + x * (VW - PAD * 2)), r2(PAD + y * (VH - PAD * 2))] as const;

const TRACK_PATH =
  circuit()
    .points.map((p, i) => {
      const [x, y] = toView(p);
      return `${i === 0 ? "M" : "L"}${x.toFixed(1)} ${y.toFixed(1)}`;
    })
    .join("") + "Z";

/** The "location samples" an outline is derived from: scattered a little off the line. */
const SAMPLES = Array.from({ length: 150 }, (_, k) => {
  const { at, normal } = circuitAt(k / 150);
  const off = (seed(k + 300) - 0.5) * 0.035;
  return toView([at[0] + (normal[0] * off) / circuit().aspect, at[1] + normal[1] * off]);
});

export function RaceReplayFigure({ wide = false }: { wide?: boolean }) {
  const pace = PACE;
  const [t, setT] = useState(START_AT);
  const [playing, setPlaying] = useState(false);
  const [visible, setVisible] = useState(false);
  const rootRef = useRef<HTMLElement>(null);

  useEffect(() => {
    const root = rootRef.current;
    if (!root) return;
    let first = true;
    const observer = new IntersectionObserver(
      ([entry]) => {
        setVisible(entry.isIntersecting);
        // Plays on its own the first time it is seen, unless the reader prefers reduced
        // motion; then it holds its frame until played.
        if (first && entry.isIntersecting) {
          first = false;
          if (!prefersReducedMotion()) setPlaying(true);
        }
      },
      { threshold: 0.25 },
    );
    observer.observe(root);
    return () => observer.disconnect();
  }, []);

  useEffect(() => {
    if (!playing || !visible) return;
    let frame = 0;
    let last = performance.now();
    const tick = (now: number) => {
      const dt = Math.min(0.1, (now - last) / 1000);
      last = now;
      setT((value) => (value + dt * SPEED) % DURATION);
      frame = requestAnimationFrame(tick);
    };
    frame = requestAnimationFrame(tick);
    return () => cancelAnimationFrame(frame);
  }, [playing, visible]);

  const sampleAt = (fraction: number) => {
    const f = ((fraction % 1) + 1) % 1;
    const k = f * TABLE;
    const i = Math.floor(k);
    return pace[i] + (pace[Math.min(TABLE, i + 1)] - pace[i]) * (k - i);
  };

  const cars = CODES.map((code, i) => {
    const run = laps(i, t);
    const { at } = circuitAt(sampleAt(run));
    return { code, i, run, at: toView(at) };
  });
  const order = [...cars].sort((a, b) => b.run - a.run);
  const leaderLap = Math.min(LAPS, Math.max(1, Math.floor(order[0].run) + 1));

  const finish = circuitAt(0);
  const [fx, fy] = toView(finish.at);
  const gate = 9;

  return (
    <figure ref={rootRef}>
      <div className="flex flex-wrap items-baseline justify-between gap-x-6 gap-y-1 pb-3">
        <p className="label text-steel">
          Replay <span className="readout text-bone">{clock(t)}</span>
          <span className="text-faint"> · Lap {leaderLap}/{LAPS}</span>
        </p>
        <p className="label text-faint">Schematic replay — not race data</p>
      </div>

      <div className={`grid gap-x-6 gap-y-4 ${wide ? "md:grid-cols-[minmax(0,1fr)_12rem]" : ""}`}>
        <svg
          viewBox={`0 0 ${VW} ${VH}`}
          className="block h-auto w-full border-y border-rule"
          role="img"
          aria-label={`Schematic circuit with ${CARS} generated cars replaying around it; ${order[0].code} leads on lap ${leaderLap} of ${LAPS}. Not race data.`}
        >
          {/* Surface and edge */}
          <path d={TRACK_PATH} fill="none" stroke="var(--color-gunmetal)" strokeWidth={11} strokeLinejoin="round" />
          <path d={TRACK_PATH} fill="none" stroke="rgb(var(--prog) / 0.55)" strokeWidth={1} strokeLinejoin="round" vectorEffect="non-scaling-stroke" />
          {SAMPLES.map(([x, y], k) => (
            <circle key={k} cx={x} cy={y} r={0.8} fill="var(--color-steel)" opacity={0.55} />
          ))}

          {/* Start / finish */}
          <line
            x1={r2(fx - finish.normal[0] * gate)}
            y1={r2(fy - finish.normal[1] * gate)}
            x2={r2(fx + finish.normal[0] * gate)}
            y2={r2(fy + finish.normal[1] * gate)}
            stroke="var(--color-bone)"
            strokeWidth={2}
          />
          <text x={fx} y={fy - 12} textAnchor="middle" className="label" fill="var(--color-faint)">
            S/F
          </text>

          {/* Cars, last place drawn first so the leader sits on top. */}
          {[...order].reverse().map((car) => {
            const leader = car.code === order[0].code;
            return (
              <g key={car.code}>
                {leader && <circle cx={car.at[0]} cy={car.at[1]} r={7} fill="none" stroke="rgb(var(--prog-2))" strokeWidth={1} />}
                <circle
                  cx={car.at[0]}
                  cy={car.at[1]}
                  r={leader ? 4 : 3.4}
                  fill={leader ? "rgb(var(--prog-2))" : "rgb(var(--prog))"}
                  stroke="var(--color-carbon)"
                  strokeWidth={1}
                />
              </g>
            );
          })}
        </svg>

        <ol
          className={`readout border-t border-rule-strong text-[0.875rem] ${wide ? "grid grid-cols-2 gap-x-6 md:block" : "grid grid-cols-2 gap-x-6"}`}
          aria-label="Timing tower"
        >
          {order.map((car, position) => {
            const ahead = order[position - 1];
            const gap = ahead ? (ahead.run - car.run) * LAP_TIME[car.i] : 0;
            return (
              <li key={car.code} className="grid grid-cols-[1.75rem_1fr_auto] items-baseline border-b border-rule py-1.5">
                <span className="label text-faint">P{position + 1}</span>
                <span className={position === 0 ? "prog-ink-2" : "text-bone"}>{car.code}</span>
                <span className="text-steel">{position === 0 ? "Leader" : `+${gap.toFixed(3)}`}</span>
              </li>
            );
          })}
        </ol>
      </div>

      <div className="mt-4 flex items-center gap-4">
        <button
          type="button"
          aria-label={playing ? "Pause replay" : "Play replay"}
          aria-pressed={playing}
          onClick={() => setPlaying((p) => !p)}
          className="grid size-9 shrink-0 place-items-center border border-rule-strong text-bone transition-colors duration-[var(--dur-fast)] hover:border-[rgb(var(--prog-2))] hover:text-[rgb(var(--prog-2))]"
        >
          <svg viewBox="0 0 20 20" className="size-3.5" aria-hidden="true">
            <path d={playing ? "M5 4h3.5v12H5zM11.5 4H15v12h-3.5z" : "M6 4l10 6-10 6z"} fill="currentColor" />
          </svg>
        </button>
        <label className="flex min-w-0 flex-1 items-center gap-3">
          <span className="sr-only">Replay position</span>
          <input
            type="range"
            min={0}
            max={DURATION}
            step={0.5}
            value={t}
            onChange={(event) => setT(Number(event.target.value))}
            className="h-9 w-full min-w-0 cursor-pointer appearance-none bg-transparent [&::-moz-range-thumb]:size-3 [&::-moz-range-thumb]:rounded-none [&::-moz-range-thumb]:border-0 [&::-moz-range-thumb]:bg-[rgb(var(--prog))] [&::-moz-range-track]:h-px [&::-moz-range-track]:bg-[var(--color-rule-strong)] [&::-webkit-slider-runnable-track]:h-px [&::-webkit-slider-runnable-track]:bg-[var(--color-rule-strong)] [&::-webkit-slider-thumb]:-mt-[5.5px] [&::-webkit-slider-thumb]:size-3 [&::-webkit-slider-thumb]:appearance-none [&::-webkit-slider-thumb]:bg-[rgb(var(--prog))]"
          />
        </label>
        <span className="label hidden text-faint xs:block">{clock(DURATION)}</span>
      </div>
    </figure>
  );
}
