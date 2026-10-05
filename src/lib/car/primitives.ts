import { cross, distance, MeshBuilder, normalize, sub } from "./mesh";
import type { MaterialId, Solid, Vec2, Vec3 } from "./types";

/**
 * The few solid primitives the car is assembled from. Each returns one `Solid` with texture
 * coordinates in metres, and decides for itself which edges are crisp and which are smooth.
 */

/** A circle in the x–y plane at a fixed z. */
export function ring(cx: number, cy: number, z: number, r: number, segments = 56): Vec3[] {
  const points: Vec3[] = [];
  for (let i = 0; i < segments; i++) {
    const a = (2 * Math.PI * i) / segments;
    points.push([cx + r * Math.cos(a), cy + r * Math.sin(a), z]);
  }
  return points;
}

/** Ear-clipping triangulation of a simple polygon in either winding. Returns vertex indices. */
export function triangulate(outline: readonly Vec2[]): number[] {
  const turn = (a: Vec2, b: Vec2, c: Vec2) => (b[0] - a[0]) * (c[1] - a[1]) - (b[1] - a[1]) * (c[0] - a[0]);
  let area = 0;
  outline.forEach((p, i) => {
    const q = outline[(i + 1) % outline.length];
    area += p[0] * q[1] - q[0] * p[1];
  });
  const order = outline.map((_, i) => i);
  if (area < 0) order.reverse();

  const triangles: number[] = [];
  // Each pass removes one ear; the guard only matters for degenerate (self-touching) input.
  for (let guard = outline.length * outline.length; order.length > 3 && guard > 0; guard--) {
    for (let i = 0; i < order.length; i++) {
      const ia = order[(i + order.length - 1) % order.length];
      const ib = order[i];
      const ic = order[(i + 1) % order.length];
      const [a, b, c] = [outline[ia], outline[ib], outline[ic]];
      if (turn(a, b, c) <= 0) continue;
      const blocked = order.some((k) => {
        if (k === ia || k === ib || k === ic) return false;
        const p = outline[k];
        return turn(a, b, p) >= 0 && turn(b, c, p) >= 0 && turn(c, a, p) >= 0;
      });
      if (blocked) continue;
      triangles.push(ia, ib, ic);
      order.splice(i, 1);
      break;
    }
  }
  if (order.length === 3) triangles.push(order[0], order[1], order[2]);
  return triangles;
}

/** Maps an outline's (u, v) and a depth `w` through the panel's thickness into the car. */
export type Placement = (u: number, v: number, w: number) => Vec3;

/** Standing along the car: u → x, v → y, at a fixed z. */
export const upright = (z: number): Placement => (u, v, w) => [u, v, z + w];
/** Lying flat: u → x, v → z, at a fixed height. */
export const level = (y: number): Placement => (u, v, w) => [u, y + w, v];
/** Standing across the car: u → z, v → y, at a fixed x. */
export const athwart = (x: number): Placement => (u, v, w) => [x + w, v, u];

/** A flat panel of real thickness — endplates, floor, fins. Faces are flat and edges crisp. */
export function slab(outline: readonly Vec2[], thickness: number, material: MaterialId, place: Placement): Solid {
  const mesh = new MeshBuilder();
  const triangles = triangulate(outline);
  const half = thickness / 2;

  for (const w of [half, -half]) {
    const first = mesh.count;
    for (const [u, v] of outline) mesh.vertex(place(u, v, w), u, v);
    for (let i = 0; i < triangles.length; i += 3) {
      mesh.tri(first + triangles[i], first + triangles[i + 1], first + triangles[i + 2]);
    }
  }

  let run = 0;
  outline.forEach((a, i) => {
    const b = outline[(i + 1) % outline.length];
    const length = Math.hypot(b[0] - a[0], b[1] - a[1]);
    mesh.quad(
      mesh.vertex(place(a[0], a[1], half), run, 0),
      mesh.vertex(place(b[0], b[1], half), run + length, 0),
      mesh.vertex(place(b[0], b[1], -half), run + length, thickness),
      mesh.vertex(place(a[0], a[1], -half), run, thickness),
    );
    run += length;
  });
  return mesh.build(material);
}

/**
 * A tube swept along a polyline. A single radius gives a round tube (halo, pushrods); a pair
 * gives a blade — [across, through] — which is how wishbones and stays are actually made.
 * "Across" is horizontal for anything that is not near-vertical.
 */
export function tube(
  points: readonly Vec3[],
  radius: number | readonly [number, number],
  material: MaterialId,
  radial = 8,
): Solid {
  const [across, through] = typeof radius === "number" ? [radius, radius] : radius;
  const girth = 2 * Math.PI * Math.max(across, through);
  const mesh = new MeshBuilder();
  let run = 0;
  points.forEach((p, i) => {
    if (i > 0) run += distance(p, points[i - 1]);
    const tangent = normalize(sub(points[Math.min(i + 1, points.length - 1)], points[Math.max(i - 1, 0)]));
    const up: Vec3 = Math.abs(tangent[1]) > 0.92 ? [1, 0, 0] : [0, 1, 0];
    const n = normalize(cross(tangent, up));
    const b = cross(tangent, n);
    for (let k = 0; k < radial; k++) {
      const a = (2 * Math.PI * k) / radial;
      const c = Math.cos(a) * across;
      const s = Math.sin(a) * through;
      mesh.vertex(
        [p[0] + n[0] * c + b[0] * s, p[1] + n[1] * c + b[1] * s, p[2] + n[2] * c + b[2] * s],
        run,
        (k / radial) * girth,
      );
    }
  });
  mesh.grid(0, points.length, radial, true);
  return mesh.build(material);
}

export interface LatheOptions {
  segments?: number;
  /** Sweep only part of the way round, from `start` through `sweep` radians. */
  start?: number;
  sweep?: number;
  /** Give every band of the profile its own vertices: machined steps instead of a smooth curve. */
  crisp?: boolean;
}

/** A surface of revolution about a z-parallel axis through (cx, cy). `profile` is [radius, z] pairs. */
export function lathe(cx: number, cy: number, profile: readonly Vec2[], material: MaterialId, options: LatheOptions = {}): Solid {
  const { segments = 48, start = 0, sweep = 2 * Math.PI, crisp = false } = options;
  const full = sweep >= 2 * Math.PI - 1e-9;
  const columns = full ? segments : segments + 1;
  const reach = Math.max(...profile.map(([r]) => r));
  const runs = [0];
  for (let j = 1; j < profile.length; j++) {
    runs.push(runs[j - 1] + Math.hypot(profile[j][0] - profile[j - 1][0], profile[j][1] - profile[j - 1][1]));
  }

  const mesh = new MeshBuilder();
  const addRing = (j: number) => {
    const [r, z] = profile[j];
    for (let i = 0; i < columns; i++) {
      const a = start + (sweep * i) / segments;
      mesh.vertex([cx + r * Math.cos(a), cy + r * Math.sin(a), z], a * reach, runs[j]);
    }
  };
  if (crisp) {
    for (let j = 0; j < profile.length - 1; j++) {
      const first = mesh.count;
      addRing(j);
      addRing(j + 1);
      mesh.grid(first, 2, columns, full);
    }
  } else {
    profile.forEach((_, j) => addRing(j));
    mesh.grid(0, profile.length, columns, full);
  }
  return mesh.build(material);
}

export interface SphereOptions {
  rings?: number;
  segments?: number;
  /** Limit to a band between two angles from the pole (+y). */
  polar?: readonly [number, number];
  /** Limit to a sector between two angles about the pole, measured from +x toward +z. */
  azimuth?: readonly [number, number];
}

/** A UV sphere, or a patch of one. */
export function sphere(centre: Vec3, radius: number, material: MaterialId, options: SphereOptions = {}): Solid {
  const { rings = 12, segments = 20, polar = [0, Math.PI], azimuth } = options;
  const columns = azimuth ? segments + 1 : segments;
  const [a0, a1] = azimuth ?? [0, 2 * Math.PI];
  const mesh = new MeshBuilder();
  for (let j = 0; j <= rings; j++) {
    const phi = polar[0] + ((polar[1] - polar[0]) * j) / rings;
    for (let i = 0; i < columns; i++) {
      const a = a0 + ((a1 - a0) * i) / segments;
      mesh.vertex(
        [
          centre[0] + radius * Math.sin(phi) * Math.cos(a),
          centre[1] + radius * Math.cos(phi),
          centre[2] + radius * Math.sin(phi) * Math.sin(a),
        ],
        a * radius,
        phi * radius,
      );
    }
  }
  mesh.grid(0, rings + 1, columns, !azimuth);
  return mesh.build(material);
}

/** An axis-aligned box with crisp edges. */
export function box(centre: Vec3, size: Vec3, material: MaterialId): Solid {
  const mesh = new MeshBuilder();
  const h: Vec3 = [size[0] / 2, size[1] / 2, size[2] / 2];
  // For each axis, the two faces perpendicular to it, spanned by the other two axes.
  for (let axis = 0; axis < 3; axis++) {
    const u = (axis + 1) % 3;
    const v = (axis + 2) % 3;
    for (const side of [-1, 1]) {
      const corner = (su: number, sv: number) => {
        const p = [centre[0], centre[1], centre[2]];
        p[axis] += side * h[axis];
        p[u] += su * h[u];
        p[v] += sv * h[v];
        return mesh.vertex([p[0], p[1], p[2]], p[u], p[v]);
      };
      mesh.quad(corner(-1, -1), corner(1, -1), corner(1, 1), corner(-1, 1));
    }
  }
  return mesh.build(material);
}
