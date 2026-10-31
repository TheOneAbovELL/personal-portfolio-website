import { floor, frontWing, rearWing } from "./aero";
import { airbox, camera, cockpit, fin, halo, mirrors, monocoque, sidepods } from "./body";
import type { Part } from "./types";
import { suspension, wheels } from "./wheels";

export { CAR } from "./spec";

/**
 * An original open-wheel single-seater, described as lofted sections, turned profiles, swept
 * tubes and flat panels. It is a form study of a modern prototype, not a replica of any real
 * car: no livery, no team geometry, no downloaded assets.
 */
export interface CarModel {
  parts: Part[];
}

let cached: CarModel | null = null;

/**
 * The parts, in the order they are built. Within a layer of the side elevation, parts are
 * painted in this order — so the fin comes before the airbox that swallows its leading edge,
 * and endplates after the wings they close.
 */
const BUILDERS: (() => Part | Part[])[] = [
  floor,
  monocoque,
  fin,
  airbox,
  camera,
  cockpit,
  halo,
  rearWing,
  sidepods,
  mirrors,
  frontWing,
  suspension,
  wheels,
];

const collect = (parts: Part[], built: Part | Part[]) => {
  if (Array.isArray(built)) parts.push(...built);
  else parts.push(built);
};

/** Build the full model. Deterministic and cheap; memoised because both renderers ask for it. */
export function buildCar(): CarModel {
  if (cached) return cached;
  const parts: Part[] = [];
  for (const build of BUILDERS) collect(parts, build());
  cached = { parts };
  return cached;
}

/**
 * The same model, built one part per task: `yieldNow` is awaited between parts so the page
 * (and the loader over it) keeps animating while the car takes shape.
 */
export async function buildCarAsync(yieldNow: () => Promise<void>): Promise<CarModel> {
  if (cached) return cached;
  const parts: Part[] = [];
  for (const build of BUILDERS) {
    collect(parts, build());
    await yieldNow();
  }
  // The synchronous builder may have run meanwhile (the SVG drawing); either result is identical.
  cached ??= { parts };
  return cached;
}
