/**
 * A schematic circuit: a closed Catmull–Rom curve through fixed control points. It is not a
 * real track — it is drawn to read as one (a long start–finish straight, a hairpin, a
 * chicane, a sweeping left-hander) and is shared by the F1 replay figure and the transition
 * that arrives at it, so the outline the transition draws is the one the figure replays on.
 *
 * Everything is deterministic: the same control points give the same curve on every render.
 */

export type Point = readonly [number, number];

/** Control points in a 200 × 100 design box, clockwise from the start–finish line. */
const CONTROL: readonly Point[] = [
  [36, 90], [95, 91], [150, 90], [166, 88], [174, 78], [173, 64], [160, 54], [156, 42],
  [166, 32], [182, 22], [178, 9], [160, 8], [132, 18], [104, 26], [92, 38], [78, 38],
  [68, 26], [52, 13], [28, 10], [13, 20], [9, 42], [12, 66], [20, 82],
];

const SUBDIVISIONS = 24;

function catmullRom(p0: Point, p1: Point, p2: Point, p3: Point, t: number): Point {
  const t2 = t * t;
  const t3 = t2 * t;
  const axis = (i: 0 | 1) =>
    0.5 *
    (2 * p1[i] +
      (-p0[i] + p2[i]) * t +
      (2 * p0[i] - 5 * p1[i] + 4 * p2[i] - p3[i]) * t2 +
      (-p0[i] + 3 * p1[i] - 3 * p2[i] + p3[i]) * t3);
  return [axis(0), axis(1)];
}

interface Circuit {
  /** Closed polyline, normalised so the outline fills 0 → 1 on both axes. */
  points: Point[];
  /** Cumulative length (in design units, aspect preserved) at each point; last = total. */
  lengths: number[];
  /** Width over height of the outline. */
  aspect: number;
}

let cached: Circuit | null = null;

function build(): Circuit {
  const raw: Point[] = [];
  const n = CONTROL.length;
  for (let k = 0; k < n; k++) {
    for (let j = 0; j < SUBDIVISIONS; j++) {
      raw.push(catmullRom(CONTROL[(k - 1 + n) % n], CONTROL[k], CONTROL[(k + 1) % n], CONTROL[(k + 2) % n], j / SUBDIVISIONS));
    }
  }
  raw.push(raw[0]);
  const xs = raw.map((p) => p[0]);
  const ys = raw.map((p) => p[1]);
  const minX = Math.min(...xs);
  const minY = Math.min(...ys);
  const w = Math.max(...xs) - minX;
  const h = Math.max(...ys) - minY;
  const lengths = [0];
  for (let i = 1; i < raw.length; i++) {
    lengths.push(lengths[i - 1] + Math.hypot(raw[i][0] - raw[i - 1][0], raw[i][1] - raw[i - 1][1]) / h);
  }
  return { points: raw.map(([x, y]) => [(x - minX) / w, (y - minY) / h] as const), lengths, aspect: w / h };
}

export function circuit(): Circuit {
  if (!cached) cached = build();
  return cached;
}

/**
 * Position on the outline at `u` (0 → 1 of the lap, by distance), normalised 0 → 1 on both
 * axes, plus the unit normal (pointing to the right of the direction of travel) in a space
 * where x is scaled by the outline's aspect.
 */
export function circuitAt(u: number): { at: Point; normal: Point } {
  const { points, lengths, aspect } = circuit();
  const total = lengths[lengths.length - 1];
  const d = (((u % 1) + 1) % 1) * total;
  let lo = 0;
  let hi = lengths.length - 1;
  while (hi - lo > 1) {
    const mid = (lo + hi) >> 1;
    if (lengths[mid] <= d) lo = mid;
    else hi = mid;
  }
  const f = (d - lengths[lo]) / (lengths[hi] - lengths[lo] || 1);
  const a = points[lo];
  const b = points[hi];
  const dx = (b[0] - a[0]) * aspect;
  const dy = b[1] - a[1];
  const len = Math.hypot(dx, dy) || 1;
  return { at: [a[0] + (b[0] - a[0]) * f, a[1] + (b[1] - a[1]) * f], normal: [-dy / len, dx / len] };
}

/**
 * How tight the outline is around `u`: 0 on a straight, rising toward 1 in the slowest
 * corners. Measured from the turn of the direction over a short window, so it is smooth.
 */
export function circuitCurvature(u: number): number {
  const span = 0.012;
  const a = circuitAt(u - span).normal;
  const b = circuitAt(u + span).normal;
  const turn = Math.acos(Math.max(-1, Math.min(1, a[0] * b[0] + a[1] * b[1])));
  return Math.min(1, turn / 1.1);
}
