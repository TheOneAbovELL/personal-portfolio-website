import { cross, distance, MeshBuilder, normalize, sub } from "./mesh";
import type { Elevation, MaterialId, Part, Solid, Stroke, Vec2, Vec3 } from "./types";

/**
 * Lofting — pure maths, no rendering dependencies.
 *
 * A body is described by a handful of cross-section "stations" along its length. Between
 * stations, each parameter is interpolated with a monotone cubic so the surface never
 * overshoots. Contours are then traced along the surface at fixed angles around the section,
 * which is what gives the drawing its flow-line character.
 */

export interface Station {
  /** Position along the car. */
  x: number;
  /** Half-width of the section. */
  w: number;
  /** Bottom and top of the section. */
  yb: number;
  yt: number;
  /** Superellipse exponent: 2 is an ellipse, higher is boxier. */
  n?: number;
  /** Lateral centre of the section. */
  zc?: number;
  /** Narrows the section toward the top (0 = none). */
  taper?: number;
}

/** Monotone cubic (PCHIP) interpolation through (xs, ys). `xs` must be strictly increasing. */
export function monotoneCubic(xs: number[], ys: number[]): (x: number) => number {
  const n = xs.length;
  const h: number[] = [];
  const d: number[] = [];
  for (let i = 0; i < n - 1; i++) {
    h[i] = xs[i + 1] - xs[i];
    d[i] = (ys[i + 1] - ys[i]) / h[i];
  }
  const m: number[] = new Array(n).fill(0);
  m[0] = d[0];
  m[n - 1] = d[n - 2];
  for (let i = 1; i < n - 1; i++) {
    if (d[i - 1] * d[i] <= 0) {
      m[i] = 0;
    } else {
      const w1 = 2 * h[i] + h[i - 1];
      const w2 = h[i] + 2 * h[i - 1];
      m[i] = (w1 + w2) / (w1 / d[i - 1] + w2 / d[i]);
    }
  }
  return (x: number) => {
    if (x <= xs[0]) return ys[0];
    if (x >= xs[n - 1]) return ys[n - 1];
    let i = 0;
    while (i < n - 2 && x > xs[i + 1]) i++;
    const t = (x - xs[i]) / h[i];
    const t2 = t * t;
    const t3 = t2 * t;
    return (
      (2 * t3 - 3 * t2 + 1) * ys[i] +
      (t3 - 2 * t2 + t) * h[i] * m[i] +
      (-2 * t3 + 3 * t2) * ys[i + 1] +
      (t3 - t2) * h[i] * m[i + 1]
    );
  };
}

/** A lofted skin, evaluated anywhere — so other parts can be fitted to it. */
export interface Skin {
  readonly xNose: number;
  readonly xTail: number;
  /** Surface point at `x`, at angle `theta` around the section: 0 is the widest point on the right, π/2 the top. */
  point(x: number, theta: number): Vec3;
  /** Outward unit normal at the same parameters. */
  normal(x: number, theta: number): Vec3;
  /** Height of the top and bottom centrelines. */
  top(x: number): number;
  bottom(x: number): number;
  /** The angle in the upper right quadrant at which the surface is `z` from the centre plane. */
  angleAt(x: number, z: number): number;
}

export function skin(stations: Station[], mirror = false): Skin {
  const sorted = [...stations].sort((a, b) => a.x - b.x);
  const xs = sorted.map((s) => s.x);
  const param = (pick: (s: Station) => number) => monotoneCubic(xs, sorted.map(pick));

  const w = param((s) => s.w);
  const yb = param((s) => s.yb);
  const yt = param((s) => s.yt);
  const n = param((s) => s.n ?? 2);
  const zc = param((s) => s.zc ?? 0);
  const taper = param((s) => s.taper ?? 0);
  const sign = mirror ? -1 : 1;

  const point = (x: number, theta: number): Vec3 => {
    const c = Math.cos(theta);
    const s = Math.sin(theta);
    const e = 2 / n(x);
    const sz = Math.sign(c) * Math.abs(c) ** e;
    const sy = Math.sign(s) * Math.abs(s) ** e;
    const yc = (yb(x) + yt(x)) / 2;
    const half = (yt(x) - yb(x)) / 2;
    const width = w(x) * (1 - taper(x) * sy);
    return [x, yc + half * sy, sign * (zc(x) + width * sz)];
  };

  const normal = (x: number, theta: number): Vec3 => {
    const d = 1e-3;
    const around = sub(point(x, theta + d), point(x, theta - d));
    const along = sub(point(x + d, theta), point(x - d, theta));
    const outward = normalize(cross(along, around));
    return mirror ? [-outward[0], -outward[1], -outward[2]] : outward;
  };

  const angleAt = (x: number, z: number): number => {
    // The section narrows monotonically from the waist to the crown, so bisection is enough.
    let lo = 0;
    let hi = Math.PI / 2;
    for (let i = 0; i < 28; i++) {
      const mid = (lo + hi) / 2;
      if (Math.abs(point(x, mid)[2]) > z) lo = mid;
      else hi = mid;
    }
    return (lo + hi) / 2;
  };

  return { xNose: xs[xs.length - 1], xTail: xs[0], point, normal, top: yt, bottom: yb, angleAt };
}

/** How an end of a loft is finished when it is not simply closed. */
export interface LoftEnd {
  /** Finish of the face: `void` for a duct, `glass` for a mirror. */
  material: MaterialId;
  /** Width of the surrounding lip, as a fraction of the section. */
  lip: number;
  /** How far the face sits behind the lip. */
  recess: number;
}

export interface LoftOptions {
  id: string;
  /** Contours around the section. Use a multiple of 4 so one runs exactly along the top. */
  lines: number;
  /** Surface resolution around the section; a multiple of `lines`. */
  facets: number;
  material: MaterialId;
  /** Samples along the length. */
  samples: number;
  layer: number;
  /** Mark the top centre contour as the signal line. */
  signalTop?: boolean;
  /** Mirror across the centre plane (for the left-hand copy of a side body). */
  mirror?: boolean;
  /**
   * A second finish below the waist, starting `drop` facets under the widest point on each
   * side: painted upper surfaces over a bare lower tub.
   */
  lower?: { material: MaterialId; drop: number };
  /**
   * Panels of another finish on the upper surface, by length: every row of facets whose
   * midpoint lies between `from` and `to` (x, metres) takes `material` instead. The end caps
   * follow the panel they close.
   */
  accents?: { from: number; to: number; material: MaterialId }[];
  /** Open ends: intakes and inset faces. Ends not listed are closed with a cap. */
  ends?: { nose?: LoftEnd; tail?: LoftEnd };
}

/** Sweep a set of stations into contour strokes, occluding solids and a side elevation. */
export function loft(stations: Station[], options: LoftOptions): Part {
  const { lines, facets, samples, mirror = false, lower, ends = {} } = options;
  const every = facets / lines;
  const shape = skin(stations, mirror);

  // Grid of surface points: rows run nose → tail, columns run around the section.
  const grid: Vec3[][] = [];
  for (let j = 0; j < samples; j++) {
    const x = shape.xNose + (shape.xTail - shape.xNose) * (j / (samples - 1));
    const row: Vec3[] = [];
    for (let k = 0; k < facets; k++) row.push(shape.point(x, (2 * Math.PI * k) / facets));
    grid.push(row);
  }

  const topIndex = facets / 4;
  const bottomIndex = (3 * facets) / 4;

  const strokes: Stroke[] = [];
  for (let k = 0; k < facets; k += every) {
    strokes.push({
      points: grid.map((row) => row[k]),
      role: "contour",
      signal: options.signalTop && k === topIndex,
    });
  }

  // Surface. Columns are counted from the keel so the one texture seam — where the girth
  // coordinate wraps — runs along the underside, out of sight.
  const column = (c: number) => (bottomIndex + c) % facets;
  const girth = grid.map((row) => {
    const out = [0];
    for (let c = 1; c <= facets; c++) out.push(out[c - 1] + distance(row[column(c)], row[column(c - 1)]));
    return out;
  });
  const isLower = (c: number) => {
    if (!lower) return false;
    const k = column(c);
    return k >= facets / 2 + lower.drop && k < facets - lower.drop;
  };

  const rowX = (j: number) => (grid[j][0][0] + grid[j + 1][0][0]) / 2;
  const finishAt = (x: number): MaterialId =>
    options.accents?.find((accent) => x >= accent.from && x < accent.to)?.material ?? options.material;

  const surface = (
    pick: (c: number) => boolean,
    material: MaterialId,
    pickRow: (j: number) => boolean = () => true,
  ): Solid | null => {
    const mesh = new MeshBuilder();
    const seen = new Map<number, number>();
    const vertex = (j: number, c: number) => {
      const key = j * (facets + 1) + c;
      let index = seen.get(key);
      if (index === undefined) {
        const p = grid[j][column(c)];
        seen.set(key, (index = mesh.vertex(p, p[0], girth[j][c])));
      }
      return index;
    };
    for (let c = 0; c < facets; c++) {
      if (!pick(c)) continue;
      for (let j = 0; j < samples - 1; j++) if (pickRow(j)) mesh.quad(vertex(j, c), vertex(j + 1, c), vertex(j + 1, c + 1), vertex(j, c + 1));
    }
    return mesh.count > 0 ? mesh.build(material) : null;
  };

  const solids: Solid[] = [];
  const finishes = new Set<MaterialId>([options.material, ...(options.accents ?? []).map((a) => a.material)]);
  for (const finish of finishes) {
    const upper = surface((c) => !isLower(c), finish, (j) => finishAt(rowX(j)) === finish);
    if (upper) solids.push(upper);
  }
  if (lower) {
    const tub = surface(isLower, lower.material);
    if (tub) solids.push(tub);
  }
  solids.push(...closeEnd(grid[0], 1, finishAt(grid[0][0][0]), ends.nose));
  solids.push(...closeEnd(grid[samples - 1], -1, finishAt(grid[samples - 1][0][0]), ends.tail));

  // Side elevation: silhouette as the fill, near-side contours as strokes.
  const top = grid.map((row) => row[topIndex]);
  const bottom = grid.map((row) => row[bottomIndex]);
  const flat = (p: Vec3): Vec2 => [p[0], p[1]];
  const near: Elevation["strokes"] = [];
  for (let k = 0; k < facets; k += every) {
    const theta = (2 * Math.PI * k) / facets;
    if (Math.cos(theta) < -1e-6) continue;
    near.push({
      points: grid.map((row) => flat(row[k])),
      role: "contour",
      signal: options.signalTop && k === topIndex,
    });
  }

  return {
    id: options.id,
    strokes,
    solids,
    elevation: mirror
      ? undefined
      : {
          layer: options.layer,
          fill: [...top.map(flat), ...bottom.map(flat).reverse()],
          strokes: near,
        },
  };
}

/**
 * Finish one end of a loft. A plain end gets a cap that shades with the skin; an open end
 * gets a flat lip in the body finish around a face set back inside it, which is what makes
 * an intake read as a hole rather than a dark sticker.
 */
function closeEnd(row: Vec3[], facing: 1 | -1, material: MaterialId, end?: LoftEnd): Solid[] {
  const count = row.length;
  const centre: Vec3 = [
    row[0][0],
    row.reduce((sum, p) => sum + p[1], 0) / count,
    row.reduce((sum, p) => sum + p[2], 0) / count,
  ];
  const inset = (factor: number, back: number): Vec3[] =>
    row.map((p): Vec3 => [
      p[0] - facing * back,
      centre[1] + (p[1] - centre[1]) * factor,
      centre[2] + (p[2] - centre[2]) * factor,
    ]);
  const ringOf = (mesh: MeshBuilder, points: Vec3[]) => points.map((p) => mesh.vertex(p, p[2], p[1]));
  const band = (mesh: MeshBuilder, a: number[], b: number[]) => {
    for (let k = 0; k < count; k++) mesh.quad(a[k], b[k], b[(k + 1) % count], a[(k + 1) % count]);
  };

  if (!end) {
    const cap = new MeshBuilder();
    const edge = ringOf(cap, row);
    const hub = cap.vertex(centre);
    for (let k = 0; k < count; k++) cap.tri(hub, edge[k], edge[(k + 1) % count]);
    return [cap.build(material)];
  }

  const mouth = inset(1 - end.lip, 0);
  const lip = new MeshBuilder();
  band(lip, ringOf(lip, row), ringOf(lip, mouth));

  const face = new MeshBuilder();
  const throat = inset((1 - end.lip) * 0.9, end.recess);
  const inner = ringOf(face, throat);
  band(face, ringOf(face, mouth), inner);
  const hub = face.vertex([centre[0] - facing * end.recess, centre[1], centre[2]]);
  for (let k = 0; k < count; k++) face.tri(hub, inner[k], inner[(k + 1) % count]);

  return [lip.build(material), face.build(end.material)];
}

/**
 * A narrow ribbon laid on a skin along a path of (x, θ) pairs — pinstripes and panel gaps.
 * It is raised a hair off the surface so the two never fight for the same depth.
 */
export function ribbon(
  shape: Skin,
  path: readonly Vec2[],
  width: number,
  material: MaterialId,
  lift = 0.0015,
): Solid {
  const mesh = new MeshBuilder();
  const centres = path.map(([x, theta]) => shape.point(x, theta));
  let run = 0;
  centres.forEach((p, i) => {
    if (i > 0) run += distance(p, centres[i - 1]);
    const tangent = normalize(sub(centres[Math.min(i + 1, centres.length - 1)], centres[Math.max(i - 1, 0)]));
    const outward = shape.normal(path[i][0], path[i][1]);
    const across = normalize(cross(outward, tangent));
    for (const side of [-1, 1]) {
      mesh.vertex(
        [
          p[0] + across[0] * side * (width / 2) + outward[0] * lift,
          p[1] + across[1] * side * (width / 2) + outward[1] * lift,
          p[2] + across[2] * side * (width / 2) + outward[2] * lift,
        ],
        run,
        side * (width / 2),
      );
    }
  });
  mesh.grid(0, centres.length, 2);
  return mesh.build(material);
}
