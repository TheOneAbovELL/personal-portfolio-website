/**
 * Risk metrics, using the same definitions as the ARGUS quant engine:
 * simple daily returns, sample statistics, 252 trading days.
 * Used only to annotate the illustrative figure on the ARGUS project.
 */

const TRADING_DAYS = 252;

const mean = (xs: number[]) => xs.reduce((sum, x) => sum + x, 0) / xs.length;

function sampleVariance(xs: number[]): number {
  const m = mean(xs);
  return xs.reduce((sum, x) => sum + (x - m) ** 2, 0) / (xs.length - 1);
}

export function dailyReturns(prices: number[]): number[] {
  const out: number[] = [];
  for (let i = 1; i < prices.length; i++) out.push(prices[i] / prices[i - 1] - 1);
  return out;
}

export function annualReturn(prices: number[]): number {
  const periods = prices.length - 1;
  return (prices[prices.length - 1] / prices[0]) ** (TRADING_DAYS / periods) - 1;
}

export function volatility(returns: number[]): number {
  return Math.sqrt(sampleVariance(returns)) * Math.sqrt(TRADING_DAYS);
}

export function sharpe(returns: number[], dailyRiskFree = 0): number {
  const excess = returns.map((r) => r - dailyRiskFree);
  return (mean(excess) / Math.sqrt(sampleVariance(excess))) * Math.sqrt(TRADING_DAYS);
}

export function beta(asset: number[], benchmark: number[]): number {
  const ma = mean(asset);
  const mb = mean(benchmark);
  let covariance = 0;
  for (let i = 0; i < asset.length; i++) covariance += (asset[i] - ma) * (benchmark[i] - mb);
  covariance /= asset.length - 1;
  return covariance / sampleVariance(benchmark);
}

export interface Drawdown {
  /** Most negative peak-to-trough move, e.g. -0.18. */
  depth: number;
  peakIndex: number;
  troughIndex: number;
}

export function maxDrawdown(prices: number[]): Drawdown {
  let peak = prices[0];
  let peakIndex = 0;
  let worst: Drawdown = { depth: 0, peakIndex: 0, troughIndex: 0 };
  prices.forEach((price, index) => {
    if (price > peak) {
      peak = price;
      peakIndex = index;
    }
    const depth = price / peak - 1;
    if (depth < worst.depth) worst = { depth, peakIndex, troughIndex: index };
  });
  return worst;
}

/** Deterministic PRNG so the illustrative series is identical on every build. */
function mulberry32(seed: number): () => number {
  let a = seed >>> 0;
  return () => {
    a = (a + 0x6d2b79f5) >>> 0;
    let t = a;
    t = Math.imul(t ^ (t >>> 15), t | 1);
    t ^= t + Math.imul(t ^ (t >>> 7), t | 61);
    return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
  };
}

/** A generated asset/benchmark pair — clearly labelled as illustrative wherever it is shown. */
export function illustrativeSeries(days = TRADING_DAYS, seed = 20261005) {
  const random = mulberry32(seed);
  const gaussian = () => {
    const u = Math.max(random(), 1e-9);
    const v = random();
    return Math.sqrt(-2 * Math.log(u)) * Math.cos(2 * Math.PI * v);
  };

  const asset = [100];
  const benchmark = [100];
  for (let day = 1; day <= days; day++) {
    // A rough patch in the middle third gives the drawdown something to measure.
    const stress = day > days * 0.42 && day < days * 0.56 ? -0.0042 : 0;
    const market = 0.00045 + stress * 0.55 + gaussian() * 0.0085;
    const own = 0.00035 + stress * 0.45 + gaussian() * 0.0105;
    benchmark.push(benchmark[day - 1] * (1 + market));
    asset.push(asset[day - 1] * (1 + 1.15 * market + own));
  }
  return { asset, benchmark };
}
