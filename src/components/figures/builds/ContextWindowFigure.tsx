"use client";

import { useEffect, useId, useRef, useState } from "react";
import { unit, useOnScreen } from "./_shared/a-shared";

/**
 * The Context Illusion — the experimental design, not its results.
 *
 * One synthetic retrieval sequence: filler, a few lures, the evidence (a key → value pair) at a
 * chosen depth, and the query at the end. Beneath it, the six positional schemes the README
 * names, each drawn as what it gives the model about position across that same sequence, from
 * its own definition: nothing for NoPE, a fixed table with a hard limit for learned absolute,
 * sine waves, log-bucketed relative distance for T5, a linear distance penalty for ALiBi, and a
 * rotation for RoPE. The readout beside each lane is that scheme's value at the evidence, seen
 * from the query — mathematics, not measurements. No accuracy is shown, because none is claimed.
 *
 * Two controls set the variables the tasks control: context length and evidence depth. While on
 * screen and untouched, the evidence sweeps slowly through the context.
 */

const EVIDENCE = "rgb(var(--prog, 167 139 250))";
const QUERY = "rgb(var(--prog-2, 96 214 230))";

const LENGTHS = [64, 128, 256, 512, 1024, 2048];
/** Schematic: the README says the learned table has a hard limit; this value is ours. */
const TRAINED = 512;
const SWEEP_MS = 90;

const LANES = [
  { id: "nope", name: "NoPE", sees: "No position — order only from the causal mask" },
  { id: "learned", name: "Learned absolute", sees: `A table of ${TRAINED} positions; no silent extrapolation` },
  { id: "sin", name: "Sinusoidal", sees: "Fixed waves of position, three frequencies drawn" },
  { id: "t5", name: "T5 relative bias", sees: "Distance to the query, log-bucketed and capped" },
  { id: "alibi", name: "ALiBi", sees: "A penalty linear in distance (one head's slope)" },
  { id: "rope", name: "RoPE", sees: "Query–key rotation by distance (one frequency)" },
] as const;

type LaneId = (typeof LANES)[number]["id"];

/** T5-style bucket for a backward distance: exact below 8, log-spaced to 128, then capped. */
function t5Bucket(r: number): number {
  const exact = 8;
  const buckets = 16;
  const maxDistance = 128;
  if (r < exact) return r;
  const b = exact + Math.floor((Math.log(r / exact) / Math.log(maxDistance / exact)) * (buckets - exact));
  return Math.min(b, buckets - 1);
}

const ALIBI_SLOPE = 1 / 16;
const ALIBI_FLOOR = 64;
const ROPE_THETA = 0.01; // radians per token: one mid-band frequency, period ≈ 628 tokens
const SIN_OMEGA = [0.1, 0.01, 0.001];

/** Rounded so server and client print the same attribute strings. */
const r2 = (v: number) => Math.round(v * 100) / 100;
const fmt = (n: number) => n.toLocaleString("en-GB");

function readout(lane: LaneId, evidence: number, query: number, length: number): string {
  const r = query - evidence;
  switch (lane) {
    case "nope":
      return "nothing to read";
    case "learned":
      return length > TRAINED ? `refused · ${fmt(length)} > ${TRAINED}` : `row ${evidence} of ${TRAINED}`;
    case "sin":
      return `p = ${fmt(evidence)}`;
    case "t5":
      return `bucket ${t5Bucket(r)}${t5Bucket(r) === 15 ? " (capped)" : ""}`;
    case "alibi":
      return `bias −${(ALIBI_SLOPE * r).toFixed(1)}`;
    case "rope": {
      const turns = (ROPE_THETA * r) / (2 * Math.PI);
      return `${turns.toFixed(2)} turns`;
    }
  }
}

export function ContextWindowFigure({ wide = false }: { wide?: boolean }) {
  const rootRef = useRef<HTMLDivElement>(null);
  const onScreen = useOnScreen(rootRef);
  const ids = useId().replace(/[^a-zA-Z0-9_-]/g, "");
  const [lengthIndex, setLengthIndex] = useState(4);
  const [depth, setDepth] = useState(35);
  const [taken, setTaken] = useState(false);
  const direction = useRef(1);

  useEffect(() => {
    if (!onScreen || taken) return;
    const timer = window.setInterval(() => {
      setDepth((d) => {
        if (d >= 92) direction.current = -1;
        if (d <= 8) direction.current = 1;
        return d + direction.current;
      });
    }, SWEEP_MS);
    return () => window.clearInterval(timer);
  }, [onScreen, taken]);

  const length = LENGTHS[lengthIndex];
  const cells = wide ? 64 : 40;
  const perCell = length / cells;
  const query = length - 1;
  // Depth 0% is the start of the context, 100% is right before the query.
  const evidence = Math.min(length - 2, Math.round((depth / 100) * (length - 2)));
  const evidenceCell = Math.min(cells - 2, Math.floor(evidence / perCell));
  const queryCell = cells - 1;
  const distance = query - evidence;

  // Strip geometry (SVG units).
  const CW = 12;
  const W = cells * CW;
  const H = 26;
  const mid = (c: number) => c * CW + CW / 2;
  const tokenAt = (c: number) => Math.floor((c + 0.5) * perCell);

  /** Lures and distractors: fixed per cell, so they stay put as the evidence moves. */
  const lure = (c: number) => c !== evidenceCell && c < cells - 1 && unit(31, c) < 0.09;

  const band = (
    <>
      <rect x={evidenceCell * CW} y={0} width={CW} height={H} fill={EVIDENCE} fillOpacity={0.12} />
      <rect x={queryCell * CW} y={0} width={CW} height={H} fill={QUERY} fillOpacity={0.12} />
    </>
  );

  const lane = (id: LaneId) => {
    switch (id) {
      case "nope":
        return Array.from({ length: cells }, (_, c) => (
          <rect key={c} x={c * CW + 2} y={H / 2 - 1} width={CW - 4} height={2} fill="var(--color-metal-2)" />
        ));
      case "learned": {
        const refused = length > TRAINED;
        return Array.from({ length: cells }, (_, c) => {
          const p = tokenAt(c);
          if (p >= TRAINED) {
            return <rect key={c} x={c * CW + 1} y={3} width={CW - 2} height={H - 6} fill={`url(#${ids}-hatch)`} />;
          }
          // A learned row per position: its look is arbitrary, so it is hashed, not computed.
          const v = unit(5, Math.floor(p / 8));
          return (
            <rect
              key={c}
              x={c * CW + 1}
              y={r2(3 + (1 - v) * 8)}
              width={CW - 2}
              height={r2(H - 6 - (1 - v) * 8)}
              fill={refused ? "var(--color-metal-2)" : EVIDENCE}
              fillOpacity={refused ? 0.6 : r2(0.28 + v * 0.4)}
            />
          );
        });
      }
      case "sin":
        return SIN_OMEGA.map((omega, k) => {
          const samples = cells * 8;
          let d = "";
          for (let s = 0; s <= samples; s++) {
            const p = (s / samples) * length;
            const y = H / 2 - Math.sin(p * omega) * (H / 2 - 3);
            d += `${s === 0 ? "M" : "L"}${((s / samples) * W).toFixed(1)} ${y.toFixed(1)}`;
          }
          return (
            <path
              key={omega}
              d={d}
              fill="none"
              stroke={EVIDENCE}
              strokeOpacity={[0.35, 0.65, 1][k]}
              strokeWidth={1}
              strokeLinejoin="round"
              vectorEffect="non-scaling-stroke"
            />
          );
        });
      case "t5":
        return Array.from({ length: cells }, (_, c) => {
          const b = t5Bucket(Math.max(0, query - tokenAt(c)));
          const next = c + 1 < cells ? t5Bucket(Math.max(0, query - tokenAt(c + 1))) : b;
          const h = r2(4 + (1 - b / 15) * (H - 8));
          return (
            <g key={c}>
              <rect x={c * CW} y={H - 2 - h} width={CW} height={h} fill={EVIDENCE} fillOpacity={r2(0.22 + (1 - b / 15) * 0.45)} />
              {next !== b && <line x1={(c + 1) * CW} x2={(c + 1) * CW} y1={1} y2={H - 1} stroke="var(--color-bone)" strokeOpacity={0.3} vectorEffect="non-scaling-stroke" />}
            </g>
          );
        });
      case "alibi": {
        const samples = cells * 2;
        let d = "";
        for (let s = 0; s <= samples; s++) {
          const p = (s / samples) * query;
          const bias = Math.min(ALIBI_FLOOR, ALIBI_SLOPE * (query - p));
          const y = 3 + (bias / ALIBI_FLOOR) * (H - 6);
          d += `${s === 0 ? "M" : "L"}${((s / samples) * W).toFixed(1)} ${y.toFixed(1)}`;
        }
        return (
          <>
            <line x1={0} x2={W} y1={3} y2={3} stroke="var(--color-rule-strong)" strokeDasharray="2 3" vectorEffect="non-scaling-stroke" />
            <path d={`${d}L${W} ${H}L0 ${H}Z`} fill={EVIDENCE} fillOpacity={0.12} />
            <path d={d} fill="none" stroke={EVIDENCE} strokeWidth={1.25} vectorEffect="non-scaling-stroke" />
          </>
        );
      }
      case "rope":
        return Array.from({ length: cells }, (_, c) => {
          const a = ROPE_THETA * (query - tokenAt(c));
          const r = H / 2 - 4;
          const cx = mid(c);
          return (
            <g key={c}>
              <circle cx={cx} cy={H / 2} r={r} fill="none" stroke="var(--color-rule-strong)" vectorEffect="non-scaling-stroke" />
              <line
                x1={cx}
                y1={H / 2}
                x2={r2(cx + Math.sin(a) * r)}
                y2={r2(H / 2 - Math.cos(a) * r)}
                stroke={c === evidenceCell ? "var(--color-bone)" : EVIDENCE}
                strokeWidth={1.25}
                vectorEffect="non-scaling-stroke"
              />
            </g>
          );
        });
    }
  };

  
  return (
    <div ref={rootRef}>
      {/* The two variables the tasks control. */}
      <div className={`grid gap-x-8 gap-y-3 pb-5 ${wide ? "sm:grid-cols-[minmax(0,1fr)_minmax(0,1fr)_auto]" : "sm:grid-cols-2"}`}>
        <label className="block">
          <span className="label flex justify-between gap-3 text-steel">
            Context length <span className="readout text-bone">{fmt(length)} tokens</span>
          </span>
          <input
            type="range"
            min={0}
            max={LENGTHS.length - 1}
            step={1}
            value={lengthIndex}
            aria-valuetext={`${fmt(length)} tokens`}
            onChange={(event) => {
              setTaken(true);
              setLengthIndex(Number(event.target.value));
            }}
            className="mt-2 block h-6 w-full cursor-pointer"
            style={{ accentColor: EVIDENCE }}
          />
        </label>
        <label className="block">
          <span className="label flex justify-between gap-3 text-steel">
            Evidence depth <span className="readout text-bone">{depth}%</span>
          </span>
          <input
            type="range"
            min={0}
            max={100}
            step={1}
            value={depth}
            aria-valuetext={`${depth}% into the context, ${fmt(distance)} tokens before the query`}
            onChange={(event) => {
              setTaken(true);
              setDepth(Number(event.target.value));
            }}
            className="mt-2 block h-6 w-full cursor-pointer"
            style={{ accentColor: EVIDENCE }}
          />
        </label>
        <p className={`label text-steel ${wide ? "self-end sm:col-span-2 lg:col-span-1 lg:text-right" : "sm:col-span-2"}`}>
          Distance to query <span className="readout text-bone">{fmt(distance)}</span>
          <span className="text-faint"> tokens</span>
        </p>
      </div>

      <svg aria-hidden="true" width={0} height={0} className="absolute">
        <defs>
          <pattern id={`${ids}-hatch`} width={5} height={5} patternUnits="userSpaceOnUse" patternTransform="rotate(45)">
            <line x1={0} y1={0} x2={0} y2={5} stroke="var(--color-bone)" strokeOpacity={0.35} strokeWidth={1} />
          </pattern>
        </defs>
      </svg>

      <div
        role="img"
        aria-label={`Schematic design of a retrieval task: a ${fmt(length)}-token context with the evidence ${depth}% of the way in, ${fmt(distance)} tokens before the query, and how each of six positional schemes — NoPE, learned absolute, sinusoidal, T5 relative bias, ALiBi and RoPE — represents position across it. Mathematics from each scheme's definition, not measured results.`}
      >
        {/* The sequence itself. */}
        <div className="grid gap-x-5 gap-y-1.5 border-b border-rule-strong pb-3 sm:grid-cols-[9.5rem_minmax(0,1fr)] sm:items-center">
          <div className="flex items-baseline justify-between gap-3 sm:block">
            <p className="label text-bone">Sequence</p>
            <p className="label text-faint sm:mt-0.5">{perCell >= 2 ? `1 cell ≈ ${fmt(Math.round(perCell))} tokens` : `1 cell = ${perCell.toFixed(1)} tokens`}</p>
          </div>
          <svg viewBox={`0 0 ${W} ${H + 12}`} className="block h-auto w-full overflow-visible">
            {Array.from({ length: cells }, (_, c) => {
              const isEvidence = c === evidenceCell;
              const isQuery = c === queryCell;
              const isLure = lure(c);
              return (
                <rect
                  key={c}
                  x={c * CW + 1.5}
                  y={4}
                  width={CW - 3}
                  height={H - 8}
                  fill={isEvidence ? EVIDENCE : isQuery ? QUERY : "var(--color-metal)"}
                  fillOpacity={isEvidence || isQuery ? 1 : 0.7}
                  stroke={isLure ? EVIDENCE : "none"}
                  strokeOpacity={0.9}
                  vectorEffect="non-scaling-stroke"
                />
              );
            })}
            {/* Distance bracket, evidence → query. */}
            <path
              d={`M${mid(evidenceCell)} ${H}V${H + 6}H${mid(queryCell)}V${H}`}
              fill="none"
              stroke="var(--color-steel)"
              strokeWidth={1}
              vectorEffect="non-scaling-stroke"
            />
          </svg>
        </div>

        {LANES.map((item) => (
          <div
            key={item.id}
            className="grid gap-x-5 gap-y-1.5 border-b border-rule py-2.5 sm:grid-cols-[9.5rem_minmax(0,1fr)] sm:items-center"
          >
            <div className="flex items-baseline justify-between gap-3 sm:block">
              <p className="label text-bone">{item.name}</p>
              <p className="readout text-[0.75rem] text-steel sm:mt-0.5">{readout(item.id, evidence, query, length)}</p>
            </div>
            <div>
              <svg viewBox={`0 0 ${W} ${H}`} className="block h-auto w-full">
                {band}
                {lane(item.id)}
              </svg>
              <p className="mt-1 text-[0.75rem] leading-snug text-faint">{item.sees}</p>
            </div>
          </div>
        ))}
      </div>

      <div className="mt-4 flex flex-wrap items-center gap-x-5 gap-y-2">
        <p className="label flex flex-wrap items-center gap-x-5 gap-y-1.5 text-steel" aria-hidden="true">
          <span className="flex items-center gap-2">
            <span className="size-2" style={{ background: EVIDENCE }} />
            Evidence · key → value
          </span>
          <span className="flex items-center gap-2">
            <span className="size-2 border" style={{ borderColor: EVIDENCE }} />
            Lures · near-miss keys
          </span>
          <span className="flex items-center gap-2">
            <span className="size-2" style={{ background: QUERY }} />
            Query
          </span>
          <span className="flex items-center gap-2">
            <span className="size-2" style={{ background: `repeating-linear-gradient(45deg, var(--color-steel) 0 1px, transparent 1px 3px)` }} />
            Past the learned table
          </span>
        </p>
        <p className="label ml-auto text-faint">Design schematic — no results shown</p>
      </div>
    </div>
  );
}

export const CAPTION =
  "The experimental design: one synthetic retrieval sequence and the six positional schemes it is run under, each drawn from its own definition. Move the context length and the evidence depth to see what each scheme offers the model about position. Schematic — no results are shown; the trained length of 512 is illustrative.";
