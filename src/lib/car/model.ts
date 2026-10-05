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

/** Build the full model. Deterministic and cheap; memoised because both renderers ask for it. */
export function buildCar(): CarModel {
  if (cached) return cached;

  // Within a layer of the side elevation, parts are painted in this order — so the fin comes
  // before the airbox that swallows its leading edge, and endplates after the wings they close.
  cached = {
    parts: [
      ...floor(),
      monocoque(),
      fin(),
      airbox(),
      camera(),
      cockpit(),
      halo(),
      ...rearWing(),
      ...sidepods(),
      ...mirrors(),
      ...frontWing(),
      suspension(),
      ...wheels(),
    ],
  };
  return cached;
}
