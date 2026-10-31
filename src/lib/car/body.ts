import { loft, ribbon, skin, type Station } from "./loft";
import { MeshBuilder } from "./mesh";
import { box, slab, sphere, tube, upright, type Placement } from "./primitives";
import { flat, LAYER, mirrorPoint, mirrorStrokes } from "./spec";
import type { Part, Solid, Stroke, Vec2, Vec3 } from "./types";

/**
 * Bodywork: the monocoque and engine cover, the sidepods, and everything that grows out of
 * them — airbox, fin, camera, cockpit, halo, mirrors.
 */

// Nose → monocoque → roll hoop → engine cover → rear crash structure.
const BODY: Station[] = [
  { x: 2.78, w: 0.05, yb: 0.15, yt: 0.215, n: 2.2 },
  { x: 2.5, w: 0.095, yb: 0.165, yt: 0.3, n: 2.3 },
  { x: 2.05, w: 0.145, yb: 0.2, yt: 0.405, n: 2.5 },
  { x: 1.6, w: 0.195, yb: 0.2, yt: 0.49, n: 2.7 },
  { x: 1.1, w: 0.25, yb: 0.1, yt: 0.565, n: 3 },
  { x: 0.6, w: 0.3, yb: 0.05, yt: 0.615, n: 3.2 },
  { x: 0.2, w: 0.32, yb: 0.05, yt: 0.635, n: 3.2 },
  { x: -0.1, w: 0.31, yb: 0.05, yt: 0.675, n: 2.9, taper: 0.1 },
  { x: -0.34, w: 0.28, yb: 0.05, yt: 0.91, n: 2.3, taper: 0.5 },
  { x: -0.8, w: 0.23, yb: 0.05, yt: 0.84, n: 2.2, taper: 0.5 },
  { x: -1.3, w: 0.17, yb: 0.06, yt: 0.68, n: 2.2, taper: 0.4 },
  { x: -1.75, w: 0.12, yb: 0.1, yt: 0.52, n: 2.2, taper: 0.25 },
  { x: -2.1, w: 0.07, yb: 0.16, yt: 0.4, n: 2.1 },
  { x: -2.3, w: 0.035, yb: 0.2, yt: 0.32, n: 2.4 },
];

// Letterbox inlet → shoulder → undercut → tapered tail.
const SIDEPOD: Station[] = [
  { x: 0.56, zc: 0.47, w: 0.23, yb: 0.34, yt: 0.555, n: 3.6 },
  { x: 0.36, zc: 0.48, w: 0.29, yb: 0.24, yt: 0.585, n: 3.6 },
  { x: 0.05, zc: 0.485, w: 0.31, yb: 0.13, yt: 0.59, n: 3.3 },
  { x: -0.4, zc: 0.48, w: 0.315, yb: 0.07, yt: 0.555, n: 3 },
  { x: -0.8, zc: 0.44, w: 0.3, yb: 0.06, yt: 0.48, n: 2.7 },
  { x: -1.2, zc: 0.36, w: 0.26, yb: 0.06, yt: 0.375, n: 2.4 },
  { x: -1.55, zc: 0.26, w: 0.2, yb: 0.07, yt: 0.275, n: 2.2 },
  { x: -1.8, zc: 0.18, w: 0.13, yb: 0.09, yt: 0.18, n: 2 },
];

// The engine air intake above the driver's head, fairing back into the engine cover.
const AIRBOX: Station[] = [
  { x: -0.21, w: 0.1, yb: 0.775, yt: 0.945, n: 2.6, taper: 0.3 },
  { x: -0.36, w: 0.11, yb: 0.76, yt: 0.955, n: 2.5, taper: 0.3 },
  { x: -0.6, w: 0.085, yb: 0.74, yt: 0.925, n: 2.3, taper: 0.3 },
  { x: -0.92, w: 0.03, yb: 0.72, yt: 0.8, n: 2 },
];

/** Where the red nose tip begins, and where the red engine cover begins (just behind the roll hoop). */
const NOSE_TIP = 2.34;
const ENGINE_COVER = -0.26;

const BODY_FACETS = 84;
const POD_FACETS = 64;
/** Facets below the waist at which paint gives way to bare carbon. */
const BODY_WATERLINE = 3;
const POD_WATERLINE = 4;

const body = skin(BODY);

/** Evenly spaced values from `a` to `b` inclusive. */
const span = (a: number, b: number, count: number) =>
  Array.from({ length: count }, (_, i) => a + ((b - a) * i) / (count - 1));

export function monocoque(): Part {
  const part = loft(BODY, {
    id: "body",
    lines: 28,
    facets: BODY_FACETS,
    samples: 96,
    material: "paint",
    layer: LAYER.body,
    signalTop: true,
    lower: { material: "carbon", drop: BODY_WATERLINE },
    // The red panels: the nose tip, and the engine cover from the roll hoop back. Between
    // them the tub stays lacquered carbon, so the red reads as chosen panels, not a dipped car.
    accents: [
      { from: NOSE_TIP, to: Infinity, material: "livery" },
      { from: -Infinity, to: ENGINE_COVER, material: "livery" },
    ],
  });
  // Panel gaps where the nose cone and the engine cover come off. Hairlines, but they are
  // what tells the eye the body is assembled from panels rather than cast in one piece.
  const waist = (-2 * Math.PI * BODY_WATERLINE) / BODY_FACETS;
  for (const x of [1.34, -1.02]) {
    const around = span(waist, Math.PI - waist, 40).map((theta): Vec2 => [x, theta]);
    part.solids?.push(ribbon(body, around, 0.006, "void", 0.001));
  }
  return part;
}

export function airbox(): Part {
  return loft(AIRBOX, {
    id: "airbox",
    lines: 8,
    facets: 32,
    samples: 14,
    material: "livery",
    layer: LAYER.spine,
    signalTop: true,
    ends: { nose: { material: "void", lip: 0.13, recess: 0.05 } },
  });
}

export function sidepods(): Part[] {
  const options = {
    lines: 16,
    facets: POD_FACETS,
    samples: 56,
    material: "livery",
    layer: LAYER.sidepod,
    lower: { material: "carbon", drop: POD_WATERLINE },
    ends: { nose: { material: "void", lip: 0.1, recess: 0.07 } },
  } as const;
  const waist = (-2 * Math.PI * POD_WATERLINE) / POD_FACETS;
  const stripe = span(0.5, -1.5, 40).map((x): Vec2 => [x, waist]);

  return [false, true].map((mirror) => {
    const pod = loft(SIDEPOD, { id: mirror ? "sidepod-l" : "sidepod-r", ...options, mirror });
    // The pinstripe sits on the joint between paint and carbon, as it would on a real car.
    pod.solids?.push(ribbon(skin(SIDEPOD, mirror), stripe, 0.007, "pinstripe"));
    return pod;
  });
}

/** The engine-cover fin, in the livery's red. Its top edge carries the drawing's accent line on from the airbox. */
export function fin(): Part {
  const top: Vec2[] = [
    [-0.6, 0.93],
    [-1.84, 0.735],
  ];
  const foot: Vec2 = [-1.9, body.top(-1.9)];
  // Below the body's top line the fin is buried, so only the part above it is drawn.
  const root = span(-1.9, -0.6, 9).map((x): Vec2 => [x, body.top(x)]);
  return {
    id: "fin",
    strokes: [
      { points: top.map(([x, y]): Vec3 => [x, y, 0]), role: "edge", signal: true },
      { points: [top[1], foot].map(([x, y]): Vec3 => [x, y, 0]), role: "edge" },
    ],
    solids: [
      slab([top[0], top[1], [-1.9, 0.44], [-1.3, 0.6], [-0.6, 0.8]], 0.008, "livery", upright(0)),
    ],
    elevation: {
      layer: LAYER.spine,
      fill: [...top, ...root],
      strokes: [
        { points: top, role: "edge", signal: true },
        { points: [top[1], foot], role: "edge" },
      ],
    },
  };
}

/** The onboard camera pod on top of the airbox, gloss black against the red. */
export function camera(): Part {
  const pod = { x: -0.4, y: 0.987, length: 0.085, height: 0.026, width: 0.2 };
  const outline: Vec2[] = [
    [pod.x + pod.length / 2, pod.y - pod.height / 2],
    [pod.x - pod.length / 2, pod.y - pod.height / 2],
    [pod.x - pod.length / 2, pod.y + pod.height / 2],
    [pod.x + pod.length / 2, pod.y + pod.height / 2],
  ];
  return {
    id: "t-camera",
    strokes: [-1, 1].map((side) => ({
      points: outline.map(([x, y]): Vec3 => [x, y, (side * pod.width) / 2]),
      role: "detail",
      closed: true,
    })),
    solids: [
      box([pod.x, pod.y, 0], [pod.length, pod.height, pod.width], "paint"),
      box([pod.x, pod.y - 0.024, 0], [0.05, 0.03, 0.02], "carbon"),
    ],
    elevation: {
      layer: LAYER.spine,
      fill: outline,
      strokes: [{ points: outline, role: "detail", closed: true }],
    },
  };
}

/** Half-width of the cockpit opening at `x`: a long oval, squarer behind the driver. */
const COCKPIT = { front: 0.74, shoulder: 0.38, back: -0.02, rear: -0.14, half: 0.19 };
function cockpitHalfWidth(x: number): number {
  const { front, shoulder, back, rear, half } = COCKPIT;
  // Rounding can carry the end stations a hair past the tips; the clamp keeps the root real.
  const arc = (t: number, power: number) => half * Math.max(0, 1 - t ** power) ** (1 / power);
  if (x > shoulder) return arc((x - shoulder) / (front - shoulder), 2.4);
  if (x < back) return arc((back - x) / (back - rear), 3);
  return half;
}

/** A point on top of the body, `z` off the centreline, raised `lift` along the surface normal. */
function onBody(x: number, z: number, lift: number): Vec3 {
  const theta = body.angleAt(x, Math.abs(z));
  const angle = z < 0 ? Math.PI - theta : theta;
  const p = body.point(x, angle);
  const n = body.normal(x, angle);
  return [p[0] + n[0] * lift, p[1] + n[1] * lift, p[2] + n[2] * lift];
}

/**
 * The cockpit. The opening is a dark panel fitted to the top of the monocoque rather than a
 * hole cut through it: from any angle the camera can reach it reads as depth, and the rim,
 * headrest, helmet and steering wheel standing in it are what sell that.
 */
export function cockpit(): Part {
  const rows = 26;
  const across = 9;
  // Cosine spacing packs rows into the rounded ends, where the outline turns fastest.
  const stations = Array.from({ length: rows }, (_, i) => {
    const t = (1 - Math.cos((Math.PI * i) / (rows - 1))) / 2;
    return COCKPIT.front + (COCKPIT.rear - COCKPIT.front) * t;
  });

  const well = new MeshBuilder();
  const rim: { right: Vec3; left: Vec3 }[] = [];
  for (const x of stations) {
    const half = cockpitHalfWidth(x);
    for (let k = 0; k < across; k++) {
      const z = -half + (2 * half * k) / (across - 1);
      well.vertex(onBody(x, z, 0.003), x, z);
    }
    rim.push({ right: onBody(x, half, 0.008), left: onBody(x, -half, 0.008) });
  }
  well.grid(0, rows, across);

  // The rim splits where the driver's shoulders are: a thin painted coaming ahead of it,
  // the padded headrest surround behind.
  const split = stations.findIndex((x) => x < 0.22);
  const ahead = rim.slice(0, split + 1);
  const behind = rim.slice(split);
  const coaming = [...ahead.map((p) => p.left).reverse(), ...ahead.slice(1).map((p) => p.right)];
  const headrest = [...behind.map((p) => p.right), ...behind.slice(0, -1).reverse().map((p) => p.left)];
  const opening = [...rim.map((p) => p.right), ...rim.slice(1, -1).reverse().map((p) => p.left)];

  const helmet: Vec3 = [0.03, 0.722, 0];
  const helmetRadius = 0.118;
  const visor = { polar: [1.0, 1.75], azimuth: [-1.3, 1.3] } as const;
  const onHelmet = (phi: number, a: number): Vec3 => [
    helmet[0] + helmetRadius * Math.sin(phi) * Math.cos(a),
    helmet[1] + helmetRadius * Math.cos(phi),
    helmet[2] + helmetRadius * Math.sin(phi) * Math.sin(a),
  ];
  const crown = Array.from({ length: 24 }, (_, i): Vec3 => {
    const a = (2 * Math.PI * i) / 24;
    return [helmet[0] + helmetRadius * Math.cos(a), helmet[1] + helmetRadius * Math.sin(a), 0];
  });
  // The near half of the visor's edge: across the top, down the side, back along the bottom.
  const visorEdge = [
    ...span(0, visor.azimuth[1], 6).map((a) => onHelmet(visor.polar[0], a)),
    ...span(visor.polar[0], visor.polar[1], 5).slice(1).map((phi) => onHelmet(phi, visor.azimuth[1])),
    ...span(visor.azimuth[1], 0, 6).slice(1).map((a) => onHelmet(visor.polar[1], a)),
  ];

  // Steering wheel: a small rounded panel standing across the cockpit, raked toward the driver.
  const wheel = { x: 0.41, rake: 0.3, sill: body.top(0.41) };
  const wheelOutline: Vec2[] = [
    [-0.13, 0.6],
    [-0.13, 0.655],
    [-0.09, 0.678],
    [0.09, 0.678],
    [0.13, 0.655],
    [0.13, 0.6],
    [0.07, 0.575],
    [-0.07, 0.575],
  ];
  const raked: Placement = (u, v, w) => [wheel.x + w - (v - 0.6) * wheel.rake, v, u];
  const wheelRim = wheelOutline.map(([u, v]) => raked(u, v, 0));
  // From the side only the part of the wheel standing proud of the cockpit sill shows.
  const wheelProud = [
    raked(0, wheel.sill, -0.01),
    raked(0, 0.678, -0.01),
    raked(0, 0.678, 0.01),
    raked(0, wheel.sill, 0.01),
  ].map(flat);

  const proud = crown.filter(([x, y]) => y > body.top(x) + 0.004).map(flat);
  const strokes: Stroke[] = [
    { points: opening, role: "edge", closed: true },
    { points: crown, role: "edge", closed: true },
    { points: visorEdge, role: "detail" },
    { points: visorEdge.map(mirrorPoint), role: "detail" },
    { points: wheelRim, role: "detail", closed: true },
  ];

  return {
    id: "cockpit",
    strokes,
    solids: [
      well.build("void"),
      tube(coaming, 0.011, "paint", 6),
      tube(headrest, [0.03, 0.024], "carbon", 8),
      sphere(helmet, helmetRadius, "silver", { rings: 14, segments: 24 }),
      sphere(helmet, helmetRadius * 1.012, "glass", { rings: 6, segments: 16, polar: visor.polar, azimuth: visor.azimuth }),
      slab(wheelOutline, 0.022, "carbon", raked),
    ],
    elevation: {
      layer: LAYER.cockpit,
      fill: proud,
      strokes: [
        { points: wheelProud, role: "detail" },
        { points: proud, role: "edge" },
        { points: visorEdge.map(flat), role: "detail" },
      ],
    },
  };
}

/** The halo: a hoop around the driver's head on a central pillar, landing on the chassis behind. */
export function halo(): Part {
  const hoop = (lift: number): Vec3[] => {
    const points: Vec3[] = [];
    const steps = 28;
    for (let i = 0; i <= steps; i++) {
      const t = -Math.PI / 2 + (Math.PI * i) / steps;
      points.push([-0.28 + 0.7 * Math.cos(t), 0.8 + 0.06 * Math.cos(t) + lift, 0.27 * Math.sin(t)]);
    }
    return points;
  };
  // Each end of the hoop turns down and inward to its mount beside the roll hoop.
  const leg: Vec3[] = [
    [-0.37, 0.772, 0.262],
    [-0.47, 0.715, 0.232],
    [-0.57, 0.63, 0.16],
  ];
  const upper = [...leg.map(mirrorPoint).reverse(), ...hoop(0), ...leg];
  const lower = hoop(-0.04);
  const pillar: Vec3[] = [
    [0.66, body.top(0.66) - 0.015, 0],
    [0.5, 0.78, 0],
    [0.42, 0.86, 0],
  ];
  const near = (points: Vec3[]): Vec2[] => points.filter((p) => p[2] >= 0).map(flat);

  return {
    id: "halo",
    strokes: [
      { points: upper, role: "edge" },
      { points: lower, role: "detail" },
      { points: pillar, role: "edge" },
    ],
    solids: [tube(upper, 0.027, "carbon"), tube(pillar, [0.012, 0.032], "carbon")],
    elevation: {
      layer: LAYER.cockpit,
      strokes: [
        { points: near(upper), role: "edge" },
        { points: near(lower), role: "detail" },
        { points: pillar.map(flat), role: "edge" },
      ],
    },
  };
}

// A mirror housing: a shallow pod, bluff toward the driver where the glass sits.
const MIRROR: Station[] = [
  { x: 0.56, zc: 0.415, w: 0.045, yb: 0.672, yt: 0.708, n: 3 },
  { x: 0.535, zc: 0.415, w: 0.07, yb: 0.662, yt: 0.718, n: 3.4 },
  { x: 0.485, zc: 0.415, w: 0.072, yb: 0.66, yt: 0.72, n: 3.6 },
];

export function mirrors(): Part[] {
  const options = {
    lines: 4,
    facets: 16,
    samples: 5,
    material: "carbon",
    layer: LAYER.trim,
    ends: { tail: { material: "glass", lip: 0.14, recess: 0.004 } },
  } as const;
  // A short stalk from the cockpit side, and a vane down to the sidepod's shoulder.
  const stalk: Vec3[] = [
    [0.52, 0.61, 0.27],
    [0.52, 0.68, 0.37],
  ];
  const vane: Vec3[] = [
    [0.52, 0.665, 0.45],
    [0.5, 0.575, 0.47],
  ];
  const supports: Stroke[] = [
    { points: stalk, role: "detail" },
    { points: vane, role: "detail" },
  ];

  return [false, true].map((mirror) => {
    const pod = loft(MIRROR, { id: mirror ? "mirror-l" : "mirror-r", ...options, mirror });
    const side = mirror ? mirrorStrokes(supports) : supports;
    pod.strokes.push(...side);
    const stays: Solid[] = [tube(side[0].points, [0.022, 0.007], "carbon", 6), tube(side[1].points, [0.005, 0.02], "carbon", 6)];
    pod.solids?.push(...stays);
    pod.elevation?.strokes.push({ points: vane.map(flat), role: "detail" });
    return pod;
  });
}
