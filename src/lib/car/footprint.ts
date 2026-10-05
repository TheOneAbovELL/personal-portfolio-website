import { FLOOR_PLAN } from "./aero";
import { CAR, TYRE } from "./spec";
import type { Vec2 } from "./types";

/** The car seen from directly above, reduced to what matters for the shadow it casts. */
export interface Footprint {
  /** Plan outlines of everything close to the ground, as [x, z] polygons. */
  low: Vec2[][];
  /** Tyre contact patches as [x, z, half-length, half-width]. */
  patches: (readonly [number, number, number, number])[];
  /** Plan outlines of everything carried higher: nose, wings, diffuser. */
  high: Vec2[][];
  /** Centre of the car along x. */
  centre: number;
}

const rect = (x0: number, x1: number, halfWidth: number, z = 0): Vec2[] => [
  [x0, z - halfWidth],
  [x1, z - halfWidth],
  [x1, z + halfWidth],
  [x0, z + halfWidth],
];

export function footprint(): Footprint {
  const r = CAR.wheelRadius;
  const corners = [
    { x: CAR.frontAxleX, ...TYRE.front },
    { x: CAR.rearAxleX, ...TYRE.rear },
  ].flatMap((tyre) => [1, -1].map((side) => ({ x: tyre.x, z: side * tyre.z, half: tyre.width / 2 })));

  return {
    centre: (CAR.noseX + CAR.tailX) / 2,
    low: [
      FLOOR_PLAN,
      // The tyre's lower third is what shades the ground beside the contact patch.
      ...corners.map((c) => rect(c.x - r * 0.75, c.x + r * 0.75, c.half, c.z)),
      // Front wing: swept leading edge, a few centimetres off the ground.
      [
        [2.96, 0],
        [2.9, 0.5],
        [2.76, 0.97],
        [2.28, 0.97],
        [2.5, 0],
        [2.28, -0.97],
        [2.76, -0.97],
        [2.9, -0.5],
      ],
    ],
    patches: corners.map((c) => [c.x, c.z, 0.065, c.half - 0.03] as const),
    high: [
      [
        [2.78, 0.05],
        [2.05, 0.145],
        [1.2, 0.24],
        [1.2, -0.24],
        [2.05, -0.145],
        [2.78, -0.05],
      ],
      rect(-2.28, -1.45, 0.52),
      rect(-2.6, -2.1, 0.5),
    ],
  };
}
