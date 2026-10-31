import { box, lathe, ring, tube } from "./primitives";
import { CAR, flat, LAYER, mirrorStrokes, TYRE } from "./spec";
import type { Part, Solid, Stroke, Vec2, Vec3 } from "./types";

/**
 * Wheels, tyres, brakes and suspension.
 *
 * The tyre is a turned profile, not a cylinder: a tucked bead behind a rim-protector lip, a
 * sidewall that bulges and carries a moulded band, rounded shoulders and a slightly crowned
 * tread. It is also loaded — the axle sits a few millimetres low and the tread is flat where
 * it meets the ground, which is most of what makes a car look as if it has weight.
 */

const R = CAR.wheelRadius;
/** Radius of the wheel rim: an 18-inch wheel in a 720 mm tyre. */
const BEAD = R * 0.64;
/** How far the loaded tyre sinks at the contact patch. */
const SQUASH = 0.006;
/** Radii of the wheel cover's machined step and of the wheel nut. */
const STEP = 0.172;
const NUT = 0.046;
/** The moulded band on the sidewall, where the compound marking is printed. */
const BAND = { inner: BEAD + 0.078, outer: BEAD + 0.09, proud: 0.0085 };

/** Half of the tyre section: [radius, distance outboard of the wheel's mid-plane], bead → crown. */
function tyreSection(half: number): Vec2[] {
  return [
    [BEAD, half - 0.02],
    [BEAD + 0.004, half - 0.006],
    [BEAD + 0.014, half + 0.001], // rim-protector lip
    [BEAD + 0.024, half - 0.003],
    [BEAD + 0.05, half + 0.004],
    [BEAD + 0.072, half + 0.006], // widest point of the sidewall
    [BAND.inner, half + BAND.proud],
    [BAND.outer, half + BAND.proud],
    [BEAD + 0.096, half + 0.004],
    [R - 0.026, half - 0.004],
    [R - 0.012, half - 0.016], // shoulder
    [R - 0.004, half - 0.036],
    [R - 0.001, half - 0.07],
    [R, 0], // crown
  ];
}

/** Flatten whatever dips below the ground: the contact patch. */
function settle(solid: Solid): Solid {
  for (let i = 1; i < solid.positions.length; i += 3) solid.positions[i] = Math.max(0, solid.positions[i]);
  return solid;
}

const grounded = (points: Vec3[]): Vec3[] => points.map(([x, y, z]): Vec3 => [x, Math.max(0, y), z]);

function wheel(id: string, x: number, tyre: { z: number; width: number }, side: 1 | -1, withElevation: boolean): Part {
  const y = R - SQUASH;
  const zc = side * tyre.z;
  const half = tyre.width / 2;
  const outer = zc + side * half;
  const inner = zc - side * half;
  /** A profile given as [radius, depth behind a face] → lathe coordinates. */
  const behind = (plane: number, into: number, profile: Vec2[]): Vec2[] =>
    profile.map(([r, depth]): Vec2 => [r, plane + into * depth]);

  const section = tyreSection(half);
  const rubber = settle(
    lathe(
      x,
      y,
      [
        ...section.map(([r, a]): Vec2 => [r, zc - side * a]),
        ...section
          .slice(0, -1)
          .reverse()
          .map(([r, a]): Vec2 => [r, zc + side * a]),
      ],
      "rubber",
      { segments: 56 },
    ),
  );

  // Compound marking: a broken red band on both sidewalls (soft, by convention).
  const marking: Solid[] = [];
  for (const face of [outer + side * (BAND.proud + 0.0008), inner - side * (BAND.proud + 0.0008)]) {
    for (let arc = 0; arc < 4; arc++) {
      marking.push(
        lathe(x, y, [[BAND.inner + 0.001, face], [BAND.outer - 0.001, face]], "marking", {
          segments: 10,
          start: (Math.PI / 2) * arc + 0.3,
          sweep: Math.PI / 2 - 0.36,
        }),
      );
    }
  }

  // Outer face: a bright rim edge around a dark turned cover, stepped twice, with a single nut.
  const crisp = { segments: 40, crisp: true };
  const outside = [
    lathe(x, y, behind(outer, -side, [[BEAD + 0.002, 0.019], [BEAD - 0.003, 0.007], [BEAD - 0.012, 0.007], [BEAD - 0.015, 0.013]]), "silver", crisp),
    lathe(
      x,
      y,
      behind(outer, -side, [
        [BEAD - 0.015, 0.013],
        [BEAD - 0.015, 0.026],
        [STEP, 0.022],
        [STEP, 0.018],
        [0.118, 0.0145],
        [0.118, 0.012],
        [0.064, 0.009],
        [0.064, 0.024],
        [NUT, 0.024],
      ]),
      "rim",
      crisp,
    ),
    lathe(x, y, behind(outer, -side, [[NUT, 0.024], [NUT, -0.002], [0.036, -0.008], [0.001, -0.008]]), "silver", { segments: 12, crisp: true }),
  ];

  // Inner face: the rim barrel, then the brake drum set inside it with its cooling scoop.
  const inside = [
    lathe(x, y, behind(inner, side, [[BEAD + 0.002, 0.019], [BEAD - 0.004, 0.006], [BEAD - 0.014, 0.006], [BEAD - 0.014, 0.05]]), "rim", crisp),
    lathe(x, y, behind(inner, side, [[BEAD - 0.014, 0.05], [0.2, 0.05]]), "void", { segments: 40 }),
    lathe(x, y, behind(inner, side, [[0.2, 0.05], [0.2, 0.006], [0.188, 0], [0.07, 0], [0.07, 0.02], [0.001, 0.02]]), "carbon", crisp),
    box([x + 0.105, y + 0.02, inner - side * 0.03], [0.12, 0.15, 0.06], "carbon"),
    box([x + 0.166, y + 0.02, inner - side * 0.03], [0.002, 0.12, 0.04], "void"),
  ];

  const strokes: Stroke[] = [
    { points: grounded(ring(x, y, outer, R)), role: "edge", closed: true },
    { points: grounded(ring(x, y, inner, R)), role: "edge", closed: true },
    { points: ring(x, y, outer, BEAD), role: "detail", closed: true },
    { points: ring(x, y, outer, STEP, 40), role: "detail", closed: true },
    { points: ring(x, y, outer, NUT, 12), role: "detail", closed: true },
  ];
  const circle = (radius: number, n = 56): Vec2[] => grounded(ring(x, y, 0, radius, n)).map(flat);

  return {
    id,
    strokes,
    solids: [rubber, ...marking, ...outside, ...inside],
    elevation: withElevation
      ? {
          layer: LAYER.wheel,
          fill: circle(R),
          strokes: [
            { points: circle(R), role: "edge", closed: true },
            { points: circle(BEAD), role: "detail", closed: true },
            { points: circle(STEP, 40), role: "detail", closed: true },
            { points: circle(NUT, 12), role: "detail", closed: true },
          ],
        }
      : undefined,
  };
}

export function wheels(): Part[] {
  return [
    wheel("wheel-fr", CAR.frontAxleX, TYRE.front, 1, true),
    wheel("wheel-fl", CAR.frontAxleX, TYRE.front, -1, false),
    wheel("wheel-rr", CAR.rearAxleX, TYRE.rear, 1, true),
    wheel("wheel-rl", CAR.rearAxleX, TYRE.rear, -1, false),
  ];
}

/**
 * Suspension. Wishbone legs are flat carbon blades running from pickups just inside the
 * chassis skin to the upright inside each wheel; pushrods and driveshafts are round.
 */
export function suspension(): Part {
  type Member = [Vec3, Vec3];
  const frontHub = TYRE.front.z - TYRE.front.width / 2 + 0.01;
  const rearHub = TYRE.rear.z - TYRE.rear.width / 2 + 0.01;
  const fx = CAR.frontAxleX;
  const rx = CAR.rearAxleX;

  const blades: Member[] = [
    // Front: upper wishbone, lower wishbone, track rod.
    [[2.05, 0.375, 0.11], [fx, 0.5, frontHub]],
    [[1.5, 0.45, 0.16], [fx, 0.5, frontHub]],
    [[2.08, 0.225, 0.1], [fx, 0.2, frontHub]],
    [[1.45, 0.2, 0.14], [fx, 0.2, frontHub]],
    [[1.98, 0.4, 0.1], [fx + 0.1, 0.48, frontHub]],
    // Rear: upper and lower wishbones.
    [[-1.45, 0.47, 0.12], [rx, 0.5, rearHub]],
    [[-2.05, 0.37, 0.06], [rx, 0.5, rearHub]],
    [[-1.4, 0.16, 0.13], [rx, 0.2, rearHub]],
    [[-2.1, 0.2, 0.05], [rx, 0.2, rearHub]],
  ];
  const rods: { member: Member; radius: number }[] = [
    { member: [[fx, 0.215, frontHub], [fx - 0.04, 0.44, 0.15]], radius: 0.011 },
    { member: [[rx, 0.215, rearHub], [rx + 0.05, 0.42, 0.1]], radius: 0.011 },
    { member: [[rx, R - SQUASH, 0.1], [rx, R - SQUASH, rearHub]], radius: 0.018 },
  ];

  const right: Stroke[] = [...blades, ...rods.map((rod) => rod.member)].map((points) => ({ points, role: "detail" }));
  const sides: (1 | -1)[] = [1, -1];
  const on = (side: 1 | -1, member: Member): Vec3[] => member.map(([x, y, z]): Vec3 => [x, y, side * z]);

  return {
    id: "suspension",
    strokes: [...right, ...mirrorStrokes(right)],
    solids: sides.flatMap((side) => [
      ...blades.map((member) => tube(on(side, member), [0.022, 0.006], "carbon", 8)),
      ...rods.map((rod) => tube(on(side, rod.member), rod.radius, "carbon", 8)),
    ]),
  };
}
