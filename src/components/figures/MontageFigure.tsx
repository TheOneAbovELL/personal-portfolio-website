import { waveform } from "@/components/work/morph-shapes";

/**
 * FIG. 03 — from signal to model: schematic channel traces, the 19 electrodes of the
 * international 10–20 system drawn as a graph, and the three branches that read them.
 *
 * Electrode positions follow the standard layout. Everything else is illustration: the
 * traces are generated from sines (not recorded data) and the edges are nearest neighbours
 * (in the model, adjacency is derived from measured inter-channel coherence).
 * Server-rendered SVG, no client JavaScript.
 */

/** The programme's colours, with the qEEG pair as the fallback outside a programme scope. */
const TOPOLOGY = "rgb(var(--prog, 79 157 255))";
const FOCUS_INK = "rgb(var(--prog-2, 96 214 230))";

const RING = 0.8;
const onRing = (degrees: number): [number, number] => {
  const a = (degrees * Math.PI) / 180;
  return [RING * Math.sin(a), RING * Math.cos(a)];
};

// x: right, y: toward the nose.
const ELECTRODES: { name: string; at: [number, number] }[] = [
  { name: "Fp1", at: onRing(-18) },
  { name: "Fp2", at: onRing(18) },
  { name: "F7", at: onRing(-54) },
  { name: "F3", at: [-0.33, 0.42] },
  { name: "Fz", at: [0, 0.4] },
  { name: "F4", at: [0.33, 0.42] },
  { name: "F8", at: onRing(54) },
  { name: "T3", at: onRing(-90) },
  { name: "C3", at: [-0.4, 0] },
  { name: "Cz", at: [0, 0] },
  { name: "C4", at: [0.4, 0] },
  { name: "T4", at: onRing(90) },
  { name: "T5", at: onRing(-126) },
  { name: "P3", at: [-0.33, -0.42] },
  { name: "Pz", at: [0, -0.4] },
  { name: "P4", at: [0.33, -0.42] },
  { name: "T6", at: onRing(126) },
  { name: "O1", at: onRing(-162) },
  { name: "O2", at: onRing(162) },
];

const FOCUS = "Cz";
const NEIGHBOUR_DISTANCE = 0.56;

/** A front-to-back selection of channels for the trace strip; the focus electrode is among them. */
const TRACE_CHANNELS = ["Fp1", "F3", "C3", "Cz", "P3", "O1"];
const TRACE = { width: 640, pitch: 19, top: 14, labelWidth: 34, amplitude: 7.5, samples: 220 };

const BRANCHES = [
  { name: "1D-CNN", sees: "Local temporal patterns in each channel" },
  { name: "GCN", sees: "Relationships between electrodes", focus: true },
  { name: "Transformer", sees: "Long-range temporal dependencies" },
];

function tracePath(channel: string, row: number): string {
  // Seeded by the electrode's index, so a channel has one shape wherever it is drawn.
  const seed = ELECTRODES.findIndex((electrode) => electrode.name === channel);
  const baseline = TRACE.top + row * TRACE.pitch;
  const span = TRACE.width - TRACE.labelWidth;
  let d = "";
  for (let k = 0; k < TRACE.samples; k++) {
    const u = k / (TRACE.samples - 1);
    const x = TRACE.labelWidth + u * span;
    const y = baseline + TRACE.amplitude * waveform(seed, u, 0.8);
    d += `${k === 0 ? "M" : "L"}${x.toFixed(1)} ${y.toFixed(1)}`;
  }
  return d;
}

export function MontageFigure() {
  const edges: { a: number; b: number; focus: boolean }[] = [];
  for (let a = 0; a < ELECTRODES.length; a++) {
    for (let b = a + 1; b < ELECTRODES.length; b++) {
      const [ax, ay] = ELECTRODES[a].at;
      const [bx, by] = ELECTRODES[b].at;
      if (Math.hypot(ax - bx, ay - by) < NEIGHBOUR_DISTANCE) {
        edges.push({ a, b, focus: ELECTRODES[a].name === FOCUS || ELECTRODES[b].name === FOCUS });
      }
    }
  }
  const neighbours = new Set(edges.filter((e) => e.focus).flatMap((e) => [e.a, e.b]));

  // SVG units: 100 per head radius, y flipped.
  const px = ([x, y]: [number, number]) => [x * 100, -y * 100] as const;
  const traceHeight = TRACE.top * 2 + (TRACE_CHANNELS.length - 1) * TRACE.pitch;

  return (
    <figure>
      <div className="flex flex-wrap items-baseline justify-between gap-x-6 gap-y-1 pb-3">
        <p className="label text-steel">
          Channels <span className="text-faint">— {TRACE_CHANNELS.length} of {ELECTRODES.length} shown</span>
        </p>
        <p className="label text-faint">Schematic — not recorded data</p>
      </div>
      <svg
        viewBox={`0 0 ${TRACE.width} ${traceHeight}`}
        className="block h-auto w-full border-y border-rule"
        role="img"
        aria-label={`Schematic waveforms for ${TRACE_CHANNELS.length} of the ${ELECTRODES.length} EEG channels, with ${FOCUS} highlighted. Generated for illustration, not recorded data.`}
      >
        {TRACE_CHANNELS.map((channel, row) => {
          const focus = channel === FOCUS;
          return (
            <g key={channel}>
              <text
                x={0}
                y={TRACE.top + row * TRACE.pitch + 3}
                fontSize={9}
                className="font-mono"
                fill={focus ? FOCUS_INK : "var(--color-steel)"}
              >
                {channel}
              </text>
              <path
                d={tracePath(channel, row)}
                fill="none"
                stroke={focus ? FOCUS_INK : TOPOLOGY}
                strokeOpacity={focus ? 1 : 0.7}
                strokeWidth={1}
                strokeLinejoin="round"
                vectorEffect="non-scaling-stroke"
              />
            </g>
          );
        })}
      </svg>

      <div className="mt-6 grid items-center gap-8 sm:grid-cols-[minmax(0,1.05fr)_minmax(0,1fr)]">
        <svg
          viewBox="-118 -122 236 240"
          className="mx-auto block h-auto w-full max-w-[21rem]"
          role="img"
          aria-label={`Top view of a head showing the 19 electrodes of the 10–20 EEG system connected as a graph, with the ${FOCUS} electrode and its neighbours highlighted.`}
        >
          {/* Head outline, nose and ears */}
          <circle r={100} stroke="var(--color-rule-strong)" strokeWidth={1} fill="none" vectorEffect="non-scaling-stroke" />
          <path d="M-10 -99.5 0 -114 10 -99.5" stroke="var(--color-rule-strong)" strokeWidth={1} fill="none" vectorEffect="non-scaling-stroke" />
          <path d="M-99.5 -12c-9 0-9 24 0 24M99.5 -12c9 0 9 24 0 24" stroke="var(--color-rule-strong)" strokeWidth={1} fill="none" vectorEffect="non-scaling-stroke" />

          {edges.map(({ a, b, focus }) => {
            const [x1, y1] = px(ELECTRODES[a].at);
            const [x2, y2] = px(ELECTRODES[b].at);
            return (
              <line
                key={`${a}-${b}`}
                x1={x1}
                y1={y1}
                x2={x2}
                y2={y2}
                stroke={focus ? FOCUS_INK : TOPOLOGY}
                strokeOpacity={focus ? 0.95 : 0.42}
                strokeWidth={1}
                vectorEffect="non-scaling-stroke"
              />
            );
          })}

          {ELECTRODES.map((electrode, index) => {
            const [cx, cy] = px(electrode.at);
            const focus = electrode.name === FOCUS;
            const near = neighbours.has(index);
            return (
              <g key={electrode.name}>
                <circle
                  cx={cx}
                  cy={cy}
                  r={focus ? 5 : 3.6}
                  fill={focus ? FOCUS_INK : "var(--color-carbon)"}
                  stroke={near ? FOCUS_INK : "var(--color-bone)"}
                  strokeOpacity={near ? 1 : 0.7}
                  strokeWidth={1}
                  vectorEffect="non-scaling-stroke"
                />
                <text
                  x={cx}
                  y={cy - 8}
                  textAnchor="middle"
                  fontSize={7}
                  className="font-mono"
                  fill={near ? "var(--color-bone)" : "var(--color-steel)"}
                >
                  {electrode.name}
                </text>
              </g>
            );
          })}
        </svg>

        <div>
          <p className="label pb-3 text-steel">Three branches, one signal</p>
          <ol>
            {BRANCHES.map((branch) => (
              <li key={branch.name} className="grid grid-cols-[6.5rem_1fr] items-baseline gap-3 border-b border-rule py-3 first:border-t">
                <span className="label text-bone" style={branch.focus ? { color: FOCUS_INK } : undefined}>
                  {branch.name}
                </span>
                <span className="text-[0.875rem] leading-snug text-steel">{branch.sees}</span>
              </li>
            ))}
          </ol>
          <p className="label mt-4 flex items-center gap-3 text-steel">
            <span aria-hidden="true" className="h-px w-6" style={{ backgroundColor: TOPOLOGY }} />
            Fused → 6-class subtype
          </p>
        </div>
      </div>
    </figure>
  );
}
