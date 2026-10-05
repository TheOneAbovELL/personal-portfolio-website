import {
  annualReturn,
  beta,
  dailyReturns,
  illustrativeSeries,
  maxDrawdown,
  sharpe,
  volatility,
} from "@/lib/quant";

const PAD = { top: 20, right: 12, bottom: 24, left: 12 };

/** The programme's colours, with the ARGUS pair as the fallback outside a programme scope. */
const SERIES = "rgb(var(--prog, 88 201 139))";
const BENCHMARK = "rgb(var(--prog-2, 60 207 192))";

const percent = (value: number, digits = 1) => `${value >= 0 ? "+" : "−"}${Math.abs(value * 100).toFixed(digits)}%`;

/**
 * FIG. 04 — what the ARGUS quant engine computes, shown on a generated series.
 * The series is synthetic; the metrics beside it are really computed from it,
 * using the engine's definitions. Server-rendered SVG, no client JavaScript.
 *
 * `wide` is the full-measure layout: a longer chart with the metrics in a column beside it.
 */
export function RiskFigure({ wide = false }: { wide?: boolean }) {
  const W = wide ? 1000 : 640;
  const H = wide ? 330 : 290;

  const { asset, benchmark } = illustrativeSeries();
  const assetReturns = dailyReturns(asset);
  const benchmarkReturns = dailyReturns(benchmark);
  const drawdown = maxDrawdown(asset);

  const stats = [
    { label: "Annual return", value: percent(annualReturn(asset)) },
    { label: "Volatility", value: `${(volatility(assetReturns) * 100).toFixed(1)}%` },
    { label: "Sharpe", value: sharpe(assetReturns).toFixed(2) },
    { label: "Beta", value: beta(assetReturns, benchmarkReturns).toFixed(2) },
    { label: "Max drawdown", value: percent(drawdown.depth), annotated: true },
  ];

  const all = [...asset, ...benchmark];
  const min = Math.min(...all);
  const max = Math.max(...all);
  const x = (i: number) => PAD.left + (i / (asset.length - 1)) * (W - PAD.left - PAD.right);
  const y = (v: number) => PAD.top + (1 - (v - min) / (max - min)) * (H - PAD.top - PAD.bottom);
  const line = (series: number[]) =>
    series.map((v, i) => `${i === 0 ? "M" : "L"}${x(i).toFixed(1)} ${y(v).toFixed(1)}`).join("");

  // Running peak, and the region between peak and price during the worst drawdown.
  const peaks: number[] = [];
  asset.reduce((peak, v) => {
    const next = Math.max(peak, v);
    peaks.push(next);
    return next;
  }, asset[0]);

  const { peakIndex, troughIndex } = drawdown;
  const peakValue = asset[peakIndex];
  const region =
    `M${x(peakIndex).toFixed(1)} ${y(peakValue).toFixed(1)}` +
    `H${x(troughIndex).toFixed(1)}` +
    asset
      .slice(peakIndex, troughIndex + 1)
      .map((_, i) => `L${x(troughIndex - i).toFixed(1)} ${y(asset[troughIndex - i]).toFixed(1)}`)
      .join("") +
    "Z";

  return (
    <figure className={wide ? "grid gap-x-8 gap-y-5 lg:grid-cols-[minmax(0,1fr)_14rem]" : undefined}>
      <div>
        <p className="label flex flex-wrap items-center gap-x-5 gap-y-1.5 pb-3 text-steel" aria-hidden="true">
          <span className="flex items-center gap-2">
            <span className="h-0.5 w-5" style={{ backgroundColor: SERIES }} />
            Series
          </span>
          <span className="flex items-center gap-2">
            <span className="h-px w-5" style={{ backgroundColor: BENCHMARK }} />
            Benchmark
          </span>
          <span className="flex items-center gap-2">
            <span className="w-5 border-t border-dashed border-faint" />
            Running peak
          </span>
          <span className="ml-auto text-faint">Illustrative — generated</span>
        </p>

        <svg
          viewBox={`0 0 ${W} ${H}`}
          className="block h-auto w-full"
          role="img"
          aria-label={`Illustrative generated price series with its maximum drawdown of ${percent(drawdown.depth)} marked from peak to trough, plotted against a benchmark.`}
        >
          <defs>
            {/* Drawdown is marked by hatching, not by a third colour: the figure keeps to its pair. */}
            <pattern id="risk-hatch" width={7} height={7} patternUnits="userSpaceOnUse" patternTransform="rotate(45)">
              <line x1={0} y1={0} x2={0} y2={7} stroke="var(--color-bone)" strokeOpacity={0.3} strokeWidth={1} />
            </pattern>
          </defs>

          {[0, 0.25, 0.5, 0.75, 1].map((t) => (
            <line
              key={t}
              x1={PAD.left}
              x2={W - PAD.right}
              y1={PAD.top + t * (H - PAD.top - PAD.bottom)}
              y2={PAD.top + t * (H - PAD.top - PAD.bottom)}
              stroke="var(--color-rule)"
              strokeWidth={1}
              vectorEffect="non-scaling-stroke"
            />
          ))}

          <path d={region} fill="url(#risk-hatch)" />
          <path
            d={line(peaks)}
            fill="none"
            stroke="var(--color-faint)"
            strokeWidth={1}
            strokeDasharray="3 4"
            vectorEffect="non-scaling-stroke"
          />
          <path
            d={line(benchmark)}
            fill="none"
            stroke={BENCHMARK}
            strokeOpacity={0.7}
            strokeWidth={1}
            strokeLinejoin="round"
            vectorEffect="non-scaling-stroke"
          />
          <path
            d={line(asset)}
            fill="none"
            stroke={SERIES}
            strokeWidth={1.5}
            strokeLinejoin="round"
            vectorEffect="non-scaling-stroke"
          />

          {/* Peak-to-trough measure, labelled where it is measured. */}
          <path
            d={`M${x(troughIndex)} ${y(peakValue)}V${y(asset[troughIndex])}M${x(troughIndex) - 4} ${y(peakValue)}h8M${x(troughIndex) - 4} ${y(asset[troughIndex])}h8`}
            stroke="var(--color-bone)"
            strokeWidth={1}
            fill="none"
            vectorEffect="non-scaling-stroke"
          />
          <rect x={x(peakIndex) - 3} y={y(peakValue) - 3} width={6} height={6} fill="var(--color-carbon)" stroke="var(--color-bone)" strokeWidth={1} />
          <text x={x(troughIndex) - 10} y={y(peakValue) + 16} textAnchor="end" className="label" fill="var(--color-bone)">
            Max drawdown {percent(drawdown.depth)}
          </text>

          <text x={PAD.left} y={H - 4} className="label" fill="var(--color-faint)">
            Day 0
          </text>
          <text x={W - PAD.right} y={H - 4} textAnchor="end" className="label" fill="var(--color-faint)">
            Day {asset.length - 1}
          </text>
        </svg>
      </div>

      <dl
        className={
          wide
            ? "grid grid-cols-2 content-start gap-px self-stretch border border-rule bg-rule xs:grid-cols-3 sm:grid-cols-5 lg:grid-cols-1"
            : "mt-4 grid grid-cols-2 gap-px border border-rule bg-rule xs:grid-cols-3 sm:grid-cols-5"
        }
      >
        {stats.map((stat) => (
          <div key={stat.label} className="flex flex-col justify-center bg-carbon px-3 py-3">
            <dt className="label flex items-center gap-2 text-faint">
              {stat.annotated && <span aria-hidden="true" className="size-1.5 border border-bone" />}
              {stat.label}
            </dt>
            <dd className="readout mt-1.5 text-[1.0625rem] text-bone">{stat.value}</dd>
          </div>
        ))}
      </dl>
    </figure>
  );
}
