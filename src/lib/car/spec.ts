import type { Stroke, Vec2, Vec3 } from "./types";

/**
 * Reference dimensions (metres): wheelbase 3.6, overall length ≈ 5.6, width 2.0, height ≈ 1.0.
 * The drawing's viewBox and the camera framing are derived from these.
 */
export const CAR = {
  noseX: 2.98,
  tailX: -2.6,
  length: 5.58,
  width: 2.0,
  height: 0.95,
  frontAxleX: 1.8,
  rearAxleX: -1.8,
  wheelRadius: 0.36,
} as const;

/** Lateral centre and width of the tyres. */
export const TYRE = {
  front: { z: 0.8475, width: 0.305 },
  rear: { z: 0.7975, width: 0.405 },
} as const;

/** Layers for the side elevation, far to near. */
export const LAYER = {
  body: 0,
  /** Everything standing on the centreline: airbox, fin, camera, rear pylon. */
  spine: 1,
  cockpit: 2,
  rearWing: 3,
  sidepod: 4,
  /** Small parts carried outboard of the sidepod: mirror, floor edge. */
  trim: 5,
  frontWing: 6,
  wheel: 7,
} as const;

export const mirrorPoint = ([x, y, z]: Vec3): Vec3 => [x, y, -z];

export const mirrorStrokes = (strokes: Stroke[]): Stroke[] =>
  strokes.map((stroke) => ({ ...stroke, points: stroke.points.map(mirrorPoint) }));

/** Drop the lateral coordinate: a point as the side elevation sees it. */
export const flat = ([x, y]: Vec3): Vec2 => [x, y];
