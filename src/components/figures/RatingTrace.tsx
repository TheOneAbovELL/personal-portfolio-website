const W = 640;
const H = 220;
const PAD = { top: 16, right: 84, bottom: 26, left: 8 };

/** Codeforces rank floors worth marking on the chart. */
const THRESHOLDS = [
  { rating: 1200, label: "Pupil" },
  { rating: 1400, label: "Specialist" },
  { rating: 1600, label: "Expert" },
];

const MONTHS = ["Jan", "Feb", "Mar", "Apr", "May", "Jun", "Jul", "Aug", "Sep", "Oct", "Nov", "Dec"];
const monthLabel = (iso: string) => `${MONTHS[Number(iso.slice(5, 7)) - 1]} ${iso.slice(0, 4)}`;

/**
 * FIG. 05 — rating after each rated contest. Real data, on a true time axis
 * (gaps between contests are shown as gaps). Server-rendered SVG.
 */
export function RatingTrace({ history }: { history: { date: string; rating: number }[] }) {
  if (history.length < 2) return null;

  const times = history.map((point) => Date.parse(point.date));
  const t0 = times[0];
  const t1 = times[times.length - 1];
  const ratings = history.map((point) => point.rating);
  const top = Math.max(...ratings);
  const yMax = Math.ceil((top + 120) / 100) * 100;
  const yMin = Math.floor((Math.min(...ratings) - 60) / 100) * 100;

  const x = (t: number) => PAD.left + ((t - t0) / (t1 - t0 || 1)) * (W - PAD.left - PAD.right);
  const y = (r: number) => PAD.top + (1 - (r - yMin) / (yMax - yMin)) * (H - PAD.top - PAD.bottom);

  const path = history.map((p, i) => `${i === 0 ? "M" : "L"}${x(times[i]).toFixed(1)} ${y(p.rating).toFixed(1)}`).join("");
  const last = history.length - 1;
  const lines = THRESHOLDS.filter((t) => t.rating > yMin && t.rating < yMax);

  return (
    <svg
      viewBox={`0 0 ${W} ${H}`}
      className="block h-auto w-full"
      role="img"
      aria-label={`Codeforces rating over ${history.length} rated contests, from ${history[0].rating} in ${monthLabel(history[0].date)} to ${history[last].rating} in ${monthLabel(history[last].date)}.`}
    >
      {lines.map((threshold) => (
        <g key={threshold.rating}>
          <line
            x1={PAD.left}
            x2={W - PAD.right}
            y1={y(threshold.rating)}
            y2={y(threshold.rating)}
            stroke="var(--color-rule-strong)"
            strokeWidth={1}
            strokeDasharray="2 5"
            vectorEffect="non-scaling-stroke"
          />
          <text x={W} y={y(threshold.rating) + 3} textAnchor="end" fontSize={9} className="label" fill="var(--color-faint)">
            {threshold.label}
          </text>
        </g>
      ))}

      <path
        d={path}
        fill="none"
        stroke="var(--color-bone)"
        strokeWidth={1.25}
        strokeLinejoin="round"
        vectorEffect="non-scaling-stroke"
      />
      {history.map((point, i) =>
        i === last ? (
          <circle key={i} cx={x(times[i])} cy={y(point.rating)} r={4} fill="var(--color-signal)" />
        ) : (
          <circle
            key={i}
            cx={x(times[i])}
            cy={y(point.rating)}
            r={2.25}
            fill="var(--color-carbon)"
            stroke="var(--color-bone)"
            strokeWidth={1}
            vectorEffect="non-scaling-stroke"
          />
        ),
      )}

      <text x={PAD.left} y={H - 6} fontSize={9} className="label" fill="var(--color-faint)">
        {monthLabel(history[0].date)}
      </text>
      <text x={W - PAD.right} y={H - 6} textAnchor="end" fontSize={9} className="label" fill="var(--color-faint)">
        {monthLabel(history[last].date)}
      </text>
    </svg>
  );
}
