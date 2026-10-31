import { MeshBuilder } from "./mesh";
import { box, level, slab, upright, type Placement } from "./primitives";
import { flat, LAYER, mirrorPoint } from "./spec";
import type { MaterialId, Part, Solid, Stroke, Vec2, Vec3 } from "./types";

/**
 * Aerodynamic surfaces: front and rear wings, the floor and its diffuser. Wing elements are
 * real sections with thickness and camber, stacked with slot gaps between them; everything
 * flat is a panel of real thickness. All of it is bare carbon except the livery's red: every
 * endplate and the rear wing's main plane.
 */

interface WingSection {
  /** Leading and trailing edge in the x–y plane. */
  le: Vec2;
  te: Vec2;
  /** How far the section bows toward its suction side, in metres. */
  camber: number;
  /** Maximum thickness, in metres. */
  thickness: number;
}

/** Chordwise sample positions, packed toward the leading edge where the section turns. */
const CHORD = [0, 0.03, 0.1, 0.25, 0.45, 0.7, 1];
const LEADING = CHORD.length - 1;

/** Half-thickness distribution of a NACA four-digit section, closed at the trailing edge; peaks at 0.5. */
const halfThickness = (s: number) =>
  5 * (0.2969 * Math.sqrt(s) - 0.126 * s - 0.3516 * s * s + 0.2843 * s ** 3 - 0.1036 * s ** 4);

/** The section as a loop: over the top from trailing edge to leading edge, then back underneath. */
function profile({ le, te, camber, thickness }: WingSection): Vec2[] {
  const cx = te[0] - le[0];
  const cy = te[1] - le[1];
  const chord = Math.hypot(cx, cy);
  // Unit normal on the suction side: downward for an element running nose → tail.
  const nx = -cy / chord;
  const ny = cx / chord;
  const at = (s: number, side: 1 | -1): Vec2 => {
    const offset = camber * 4 * s * (1 - s) + side * thickness * halfThickness(s);
    return [le[0] + cx * s + nx * offset, le[1] + cy * s + ny * offset];
  };
  return [...[...CHORD].reverse().map((s) => at(s, -1)), ...CHORD.slice(1).map((s) => at(s, 1))];
}

/** A spanwise wing element whose section may vary with `t`, the fraction of the half-span. */
function wingElement(
  id: string,
  halfSpan: number,
  steps: number,
  section: (t: number) => WingSection,
  drawTrailing: boolean,
  material: MaterialId = "carbon",
): Part {
  const mesh = new MeshBuilder();
  const loops: Vec3[][] = [];
  for (let i = 0; i <= steps; i++) {
    const z = -halfSpan + (2 * halfSpan * i) / steps;
    const loop = profile(section(Math.abs(z) / halfSpan)).map(([x, y]): Vec3 => [x, y, z]);
    let run = 0;
    loop.forEach((p, k) => {
      if (k > 0) run += Math.hypot(p[0] - loop[k - 1][0], p[1] - loop[k - 1][1]);
      mesh.vertex(p, z, run);
    });
    loops.push(loop);
  }
  // Not wrapped: the trailing edge keeps separate vertices above and below, so it stays sharp.
  mesh.grid(0, steps + 1, 2 * CHORD.length - 1);

  // Tips: a ladder between matching points of the upper and lower surfaces.
  for (const loop of [loops[0], loops[steps]]) {
    const first = mesh.count;
    for (const p of loop) mesh.vertex(p, p[0], p[1]);
    for (let k = 0; k < LEADING; k++) {
      mesh.quad(first + LEADING - k, first + LEADING - k - 1, first + LEADING + k + 1, first + LEADING + k);
    }
  }

  const strokes: Stroke[] = [{ points: loops.map((loop) => loop[LEADING]), role: "edge" }];
  if (drawTrailing) strokes.push({ points: loops.map((loop) => loop[0]), role: "edge" });
  return { id, strokes, solids: [mesh.build(material)] };
}

/** An endplate, pylon or strake: a panel standing along the car, drawn as its outline. Carbon unless painted. */
function panel(
  id: string,
  outline: Vec2[],
  z: number,
  thickness: number,
  layer?: number,
  material: MaterialId = "carbon",
): Part {
  return {
    id,
    strokes: [{ points: outline.map(([x, y]): Vec3 => [x, y, z]), role: "edge", closed: true }],
    solids: [slab(outline, thickness, material, upright(z))],
    elevation:
      layer === undefined
        ? undefined
        : { layer, fill: outline, strokes: [{ points: outline, role: "edge", closed: true }] },
  };
}

export function frontWing(): Part[] {
  const halfSpan = 0.965;
  const elements = 4;
  // Each element starts behind and above the one in front, overlapping it to leave a slot.
  const section =
    (i: number) =>
    (t: number): WingSection => {
      const x = 2.96 - 0.2 * t ** 1.6 - i * 0.105;
      const y = 0.07 + 0.05 * t * t + i * 0.047;
      return { le: [x, y], te: [x - 0.125, y + 0.036], camber: 0.012, thickness: i === 0 ? 0.018 : 0.013 };
    };

  const parts: Part[] = [];
  for (let i = 0; i < elements; i++) {
    const element = wingElement(`front-wing-${i}`, halfSpan, 24, section(i), i === elements - 1);
    // Seen from the side, the swept leading edges are the lines that describe the wing.
    element.elevation = {
      layer: LAYER.frontWing,
      strokes: element.strokes.map((stroke) => ({
        points: stroke.points.filter((p) => p[2] >= 0).map(flat),
        role: stroke.role,
      })),
    };
    parts.push(element);
  }

  const outline: Vec2[] = [
    [2.84, 0.075],
    [2.8, 0.045],
    [2.34, 0.045],
    [2.26, 0.085],
    [2.26, 0.34],
    [2.42, 0.33],
    [2.72, 0.19],
  ];
  const z = halfSpan + 0.004;
  // Red endplates frame the carbon wing from the front, as the rear ones do from behind.
  parts.push(panel("front-endplate-r", outline, z, 0.008, LAYER.frontWing, "livery"));
  parts.push(panel("front-endplate-l", outline, -z, 0.008, undefined, "livery"));
  return parts;
}

export function rearWing(): Part[] {
  const halfSpan = 0.5;
  // The main plane dips toward the centre: a spoon profile.
  const main = (t: number): WingSection => {
    const dip = 1 - t * t;
    return { le: [-2.12, 0.825 - 0.02 * dip], te: [-2.42, 0.8], camber: 0.035 + 0.02 * dip, thickness: 0.03 };
  };
  const flap = (): WingSection => ({ le: [-2.405, 0.832], te: [-2.575, 0.95], camber: 0.018, thickness: 0.014 });
  const beam = (): WingSection => ({ le: [-2.19, 0.355], te: [-2.37, 0.425], camber: 0.02, thickness: 0.014 });

  const outline: Vec2[] = [
    [-2.02, 0.3],
    [-2.58, 0.3],
    [-2.61, 0.97],
    [-2.08, 0.97],
    [-2.0, 0.66],
  ];
  const thickness = 0.01;
  // The rear endplates and main plane carry the livery's red: the last thing a following car sees.
  const right = panel("rear-endplate-r", outline, halfSpan + thickness / 2, thickness, LAYER.rearWing, "livery");
  const left = panel("rear-endplate-l", outline, -(halfSpan + thickness / 2), thickness, undefined, "livery");

  // Where each element meets the endplate its section shows on the outside — a line of
  // fasteners on the real thing. It also gives the side elevation its wing sections, which
  // would otherwise collapse to points.
  const face = halfSpan + thickness + 0.001;
  for (const section of [main(1), flap(), beam()]) {
    const loop = profile(section);
    right.strokes.push({ points: loop.map(([x, y]): Vec3 => [x, y, face]), role: "detail", closed: true });
    left.strokes.push({ points: loop.map(([x, y]): Vec3 => [x, y, -face]), role: "detail", closed: true });
    right.elevation?.strokes.push({ points: loop, role: "detail", closed: true });
  }

  // Central pylon from the crash structure up to the main plane.
  const pylon = panel(
    "rear-wing-pylon",
    [
      [-1.92, 0.4],
      [-2.12, 0.34],
      [-2.31, 0.75],
      [-2.2, 0.79],
      [-2.13, 0.77],
    ],
    0,
    0.014,
    LAYER.spine,
  );

  // Rain light on the end of the crash structure.
  const lamp = { x: -2.317, y: 0.26, depth: 0.03, height: 0.1, width: 0.05 };
  const lens: Vec2[] = [
    [lamp.x + lamp.depth / 2, lamp.y - lamp.height / 2],
    [lamp.x - lamp.depth / 2, lamp.y - lamp.height / 2],
    [lamp.x - lamp.depth / 2, lamp.y + lamp.height / 2],
    [lamp.x + lamp.depth / 2, lamp.y + lamp.height / 2],
  ];
  const rainLight: Part = {
    id: "rain-light",
    strokes: [{ points: lens.map(([x, y]): Vec3 => [x, y, lamp.width / 2]), role: "detail", closed: true }],
    solids: [box([lamp.x, lamp.y, 0], [lamp.depth, lamp.height, lamp.width], "lamp")],
    elevation: { layer: LAYER.spine, fill: lens, strokes: [{ points: lens, role: "detail", closed: true }] },
  };

  return [
    pylon,
    rainLight,
    wingElement("rear-wing-main", halfSpan, 16, main, true, "livery"),
    wingElement("rear-wing-flap", halfSpan, 2, flap, true),
    wingElement("beam-wing", halfSpan, 2, beam, true),
    right,
    left,
  ];
}

/** Height of the diffuser roof: flat under the car, then curving up to the exit. */
const DIFFUSER = { start: -1.5, exit: -2.28, halfWidth: 0.52, rise: 0.26 };
const FLOOR_Y = 0.036;
const diffuserRoof = (x: number) =>
  FLOOR_Y + 0.007 + DIFFUSER.rise * ((DIFFUSER.start - x) / (DIFFUSER.start - DIFFUSER.exit)) ** 1.6;

// Plan view of the floor's right half, leading edge → rear: keel, inlet, flat edge, tyre cut-out.
const FLOOR_HALF: Vec2[] = [
  [1.25, 0.2],
  [1.0, 0.5],
  [0.66, 0.78],
  [-1.3, 0.78],
  [-1.42, 0.585],
  [DIFFUSER.start, 0.57],
];
/** The floor in plan, as [x, z]. */
export const FLOOR_PLAN: Vec2[] = [...FLOOR_HALF, ...[...FLOOR_HALF].reverse().map(([x, z]): Vec2 => [x, -z])];

export function floor(): Part[] {
  const plan = FLOOR_PLAN;

  // Edge wing: a low lip standing along each side of the floor.
  const lip: Vec2[] = [
    [0.56, 0.043],
    [-1.24, 0.043],
    [-1.27, 0.06],
    [-1.2, 0.078],
    [0.5, 0.078],
    [0.585, 0.06],
  ];
  // Floor fence: a vane angled across the inlet, from the keel out to the floor edge.
  const fence = { from: [1.0, 0.5], to: [0.66, 0.77] } as const;
  const run = Math.hypot(fence.to[0] - fence.from[0], fence.to[1] - fence.from[1]);
  const dx = (fence.to[0] - fence.from[0]) / run;
  const dz = (fence.to[1] - fence.from[1]) / run;
  const vane: Vec2[] = [
    [0, 0.043],
    [run, 0.043],
    [run, 0.2],
    [run * 0.7, 0.21],
    [0, 0.12],
  ];
  const angled =
    (side: 1 | -1): Placement =>
    (u, v, w) => [fence.from[0] + dx * u - dz * w, v, side * (fence.from[1] + dz * u + dx * w)];
  const vaneTop = [vane[4], vane[3], vane[2]].map(([u, v]) => angled(1)(u, v, 0));

  const lipTop = [lip[2], lip[3], lip[4], lip[5]].map(([x, y]): Vec3 => [x, y, 0.777]);
  const solids: Solid[] = [slab(plan, 0.014, "carbon", level(FLOOR_Y))];
  for (const side of [1, -1] as const) {
    solids.push(slab(lip, 0.006, "carbon", upright(side * 0.777)), slab(vane, 0.006, "carbon", angled(side)));
  }

  const board: Part = {
    id: "floor",
    strokes: [
      { points: plan.map(([x, z]): Vec3 => [x, FLOOR_Y, z]), role: "edge", closed: true },
      { points: lipTop, role: "detail" },
      { points: lipTop.map(mirrorPoint), role: "detail" },
      { points: vaneTop, role: "detail" },
      { points: vaneTop.map(mirrorPoint), role: "detail" },
    ],
    solids,
    elevation: {
      layer: LAYER.body,
      strokes: [{ points: [[1.25, FLOOR_Y], [DIFFUSER.start, FLOOR_Y]], role: "edge" }],
    },
  };
  const edge: Part = {
    id: "floor-edge",
    strokes: [],
    elevation: {
      layer: LAYER.trim,
      fill: lip,
      strokes: [{ points: lipTop.map(flat), role: "detail" }],
    },
  };
  return [board, diffuser(), edge];
}

function diffuser(): Part {
  const { start, exit, halfWidth } = DIFFUSER;
  const steps = 6;
  const xs = Array.from({ length: steps + 1 }, (_, i) => start + ((exit - start) * i) / steps);

  const roof = new MeshBuilder();
  for (const x of xs) {
    for (const side of [-1, 1]) roof.vertex([x, diffuserRoof(x), side * halfWidth], x, side * halfWidth);
  }
  roof.grid(0, xs.length, 2);

  // Side walls and strakes: wedges closing the tunnel under the roof.
  const wedge: Vec2[] = [[start, FLOOR_Y - 0.007], [exit, FLOOR_Y - 0.007], ...[...xs].reverse().map((x): Vec2 => [x, diffuserRoof(x)])];
  const solids: Solid[] = [roof.build("carbon")];
  for (const z of [-halfWidth, -0.2, 0.2, halfWidth]) solids.push(slab(wedge, 0.006, "carbon", upright(z)));

  const exitEdge: Vec3[] = [
    [exit, diffuserRoof(exit), -halfWidth],
    [exit, diffuserRoof(exit), halfWidth],
  ];
  return {
    id: "diffuser",
    strokes: [
      { points: exitEdge, role: "edge" },
      { points: wedge.map(([x, y]): Vec3 => [x, y, halfWidth]), role: "detail", closed: true },
      { points: wedge.map(([x, y]): Vec3 => [x, y, -halfWidth]), role: "detail", closed: true },
    ],
    solids,
    elevation: { layer: LAYER.body, strokes: [{ points: wedge, role: "detail", closed: true }] },
  };
}
