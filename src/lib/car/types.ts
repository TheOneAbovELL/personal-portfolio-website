/**
 * Shared vocabulary of the car model — pure data, no rendering dependencies.
 *
 * Axes: +x forward (nose), +y up, +z to the car's right. Units are metres.
 */

export type Vec3 = readonly [number, number, number];
export type Vec2 = readonly [number, number];

export type StrokeRole = "contour" | "edge" | "detail";

export interface Stroke {
  points: Vec3[];
  role: StrokeRole;
  closed?: boolean;
  /** The accent line of the drawing: the car's upper profile. */
  signal?: boolean;
}

/**
 * Surface finishes. The renderer maps each to a physically based material.
 *
 *   paint    metallic graphite under clearcoat — upper bodywork
 *   carbon   bare twill-weave carbon fibre — wings, floor, lower bodywork, suspension
 *   rubber   tyre compound
 *   rim      dark anodised wheel cover, turned on a lathe
 *   silver   machined bright metal — rim edges, wheel nuts, the helmet shell
 *   glass    dark gloss — visor, mirror glass
 *   void     an opening: cockpit, intakes. Absorbs light.
 *   signal   racing yellow — T-camera, tyre compound band
 *   data     technical teal — the pinstripe
 *   lamp     the red rain light
 */
export type MaterialId =
  | "paint"
  | "carbon"
  | "rubber"
  | "rim"
  | "silver"
  | "glass"
  | "void"
  | "signal"
  | "data"
  | "lamp";

export interface Solid {
  positions: number[];
  indices: number[];
  /** Texture coordinates in metres, two per vertex, so woven and turned finishes keep their real scale. */
  uvs: number[];
  material: MaterialId;
}

/** A 2D side-elevation rendering of a part, used for the server-rendered drawing. */
export interface Elevation {
  /** Painter's order: lower layers are drawn first and occluded by later fills. */
  layer: number;
  /** Closed outline filled with the background colour to hide what is behind the part. */
  fill?: Vec2[];
  strokes: { points: Vec2[]; role: StrokeRole; closed?: boolean; signal?: boolean }[];
}

export interface Part {
  id: string;
  strokes: Stroke[];
  solids?: Solid[];
  elevation?: Elevation;
}
