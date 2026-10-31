import { BufferGeometry, Float32BufferAttribute } from "three";
import type { MaterialId } from "@/lib/car/types";
import type { CarModel } from "@/lib/car/model";
import type { Yield } from "./yield";

// Small deterministic hash so per-stroke variation is stable between renders.
const hash = (i: number) => {
  const s = Math.sin(i * 127.1 + 311.7) * 43758.5453;
  return s - Math.floor(s);
};

/** Parts painted in the livery red; their streaks are red too. */
const LIVERY_PARTS = new Set(["fin", "airbox", "rear-wing-main", "rear-endplate-r", "rear-endplate-l"]);
/** How many speed streaks trail the car, at most, and how long the longest is (metres). */
const STREAKS = 150;
const STREAK_LENGTH = 7;

/**
 * Speed streaks for the hero's exit: short horizontal segments anchored on points of the car's
 * own outline, each with its tail pointing aft. The vertex shader stretches the tails as the car
 * accelerates, so the streaks grow out of the car's lines rather than appearing beside them.
 *
 * Anchors are the stroke points that stand proud of the body — wing tips, wheels, the spine —
 * picked deterministically, so the pattern is the same on every visit.
 */
export function buildStreakGeometry(model: CarModel): BufferGeometry {
  const candidates: { p: readonly [number, number, number]; red: boolean }[] = [];
  for (const part of model.parts) {
    const red = LIVERY_PARTS.has(part.id);
    for (const stroke of part.strokes) {
      if (stroke.role === "detail") continue;
      for (const p of stroke.points) candidates.push({ p, red });
    }
  }

  const position: number[] = [];
  const tail: number[] = [];
  const length: number[] = [];
  const seed: number[] = [];
  const red: number[] = [];
  const step = Math.max(1, Math.floor(candidates.length / STREAKS));
  for (let i = 0, n = 0; i < candidates.length && n < STREAKS; i += step, n++) {
    const pick = candidates[Math.min(candidates.length - 1, i + Math.floor(hash(n) * step))];
    const s = hash(n + 97);
    // Higher anchors draw longer streaks: the air off the top of the car is cleanest.
    const len = STREAK_LENGTH * (0.35 + 0.65 * s) * (0.6 + 0.5 * Math.min(1, pick.p[1]));
    for (const t of [0, 1]) {
      position.push(pick.p[0], pick.p[1], pick.p[2]);
      tail.push(t);
      length.push(len);
      seed.push(s);
      red.push(pick.red ? 1 : 0);
    }
  }

  const geometry = new BufferGeometry();
  geometry.setAttribute("position", new Float32BufferAttribute(position, 3));
  geometry.setAttribute("aTail", new Float32BufferAttribute(tail, 1));
  geometry.setAttribute("aLength", new Float32BufferAttribute(length, 1));
  geometry.setAttribute("aSeed", new Float32BufferAttribute(seed, 1));
  geometry.setAttribute("aRed", new Float32BufferAttribute(red, 1));
  return geometry;
}

/**
 * Every surface with a given finish, merged into one geometry (one draw call each).
 * Normals are averaged per vertex, so each solid is smooth exactly where it shares vertices.
 * One finish per task: `yieldNow` is awaited between them.
 */
export async function buildSolidGeometries(model: CarModel, yieldNow: Yield): Promise<Map<MaterialId, BufferGeometry>> {
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
    await yieldNow();
  }
  return geometries;
}
