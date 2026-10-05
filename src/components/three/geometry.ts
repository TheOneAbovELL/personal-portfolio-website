import { BufferGeometry, Float32BufferAttribute } from "three";
import type { MaterialId, StrokeRole } from "@/lib/car/types";
import { CAR, type CarModel } from "@/lib/car/model";

const ROLE_ALPHA: Record<StrokeRole, number> = {
  contour: 0.3,
  edge: 0.62,
  detail: 0.34,
};

/** How far the relaxed traces extend past the car, and how tall the band of traces is. */
const TRACE_STRETCH = 3.4;
const TRACE_BAND = 2.3;
const TRACE_CENTRE = 0.44;

// Small deterministic hash so per-stroke variation is stable between renders.
const hash = (i: number) => {
  const s = Math.sin(i * 127.1 + 311.7) * 43758.5453;
  return s - Math.floor(s);
};

/**
 * All strokes as one LineSegments geometry (a single draw call).
 *
 * Each vertex also carries its "relaxed" position: the same stroke flattened into a straight
 * horizontal trace. The vertex shader blends between the two, which is how the car dissolves
 * into lines on scroll.
 */
export function buildLineGeometry(model: CarModel): BufferGeometry {
  const strokes = model.parts.flatMap((part) => part.strokes);

  // Rank strokes by mean height so each one relaxes to its own evenly spaced lane.
  const meanY = strokes.map((s) => s.points.reduce((sum, p) => sum + p[1], 0) / s.points.length);
  const order = strokes.map((_, i) => i).sort((a, b) => meanY[a] - meanY[b]);
  const lane = new Array<number>(strokes.length);
  order.forEach((strokeIndex, rank) => {
    lane[strokeIndex] = TRACE_CENTRE + (rank / (strokes.length - 1) - 0.5) * TRACE_BAND;
  });

  const position: number[] = [];
  const relaxed: number[] = [];
  const along: number[] = [];
  const seed: number[] = [];
  const alpha: number[] = [];
  const signal: number[] = [];

  strokes.forEach((stroke, index) => {
    const pts = stroke.points;
    const count = stroke.closed ? pts.length : pts.length - 1;
    const strokeSeed = hash(index);
    for (let i = 0; i < count; i++) {
      for (const p of [pts[i], pts[(i + 1) % pts.length]]) {
        position.push(p[0], p[1], p[2]);
        relaxed.push(p[0] * TRACE_STRETCH, lane[index], 0);
        along.push((CAR.noseX - p[0]) / CAR.length);
        seed.push(strokeSeed);
        alpha.push(ROLE_ALPHA[stroke.role]);
        signal.push(stroke.signal ? 1 : 0);
      }
    }
  });

  const geometry = new BufferGeometry();
  geometry.setAttribute("position", new Float32BufferAttribute(position, 3));
  geometry.setAttribute("aRelaxed", new Float32BufferAttribute(relaxed, 3));
  geometry.setAttribute("aAlong", new Float32BufferAttribute(along, 1));
  geometry.setAttribute("aSeed", new Float32BufferAttribute(seed, 1));
  geometry.setAttribute("aAlpha", new Float32BufferAttribute(alpha, 1));
  geometry.setAttribute("aSignal", new Float32BufferAttribute(signal, 1));
  return geometry;
}

/**
 * Every surface with a given finish, merged into one geometry (one draw call each).
 * Normals are averaged per vertex, so each solid is smooth exactly where it shares vertices.
 */
export function buildSolidGeometries(model: CarModel): Map<MaterialId, BufferGeometry> {
  const buckets = new Map<MaterialId, { position: number[]; uv: number[]; index: number[] }>();
  for (const part of model.parts) {
    for (const solid of part.solids ?? []) {
      let bucket = buckets.get(solid.material);
      if (!bucket) buckets.set(solid.material, (bucket = { position: [], uv: [], index: [] }));
      const offset = bucket.position.length / 3;
      for (const value of solid.positions) bucket.position.push(value);
      for (const value of solid.uvs) bucket.uv.push(value);
      for (const i of solid.indices) bucket.index.push(offset + i);
    }
  }

  const geometries = new Map<MaterialId, BufferGeometry>();
  for (const [material, { position, uv, index }] of buckets) {
    const geometry = new BufferGeometry();
    geometry.setAttribute("position", new Float32BufferAttribute(position, 3));
    geometry.setAttribute("uv", new Float32BufferAttribute(uv, 2));
    geometry.setIndex(index);
    geometry.computeVertexNormals();
    geometries.set(material, geometry);
  }
  return geometries;
}
