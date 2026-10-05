import type { Rgb } from "../layout";
import { BONE, RED, STEEL, YELLOW } from "../palettes";

/**
 * Everything a painter may read for one frame. Painters only draw: they never measure the
 * page, and every value here has already been eased by the controller.
 */
export interface Frame {
  ctx: CanvasRenderingContext2D;
  /** Viewport size in CSS pixels. */
  width: number;
  height: number;
  /** Page → screen offset, rounded so horizontal hairlines stay on the pixel grid. */
  scrollY: number;
  /** Page-space position of the reading line. */
  readY: number;
  /** The colour the line is lit in here, as a CSS colour. */
  accent: string;
  /** 0 → 1 scroll intensity, with inertia. */
  energy: number;
  /** Eased scroll direction and strength: -1 (up) → 1 (down). */
  drift: number;
  /** 0 → 1 activity reported by the interface. */
  activity: number;
  /** Seconds. Only the telemetry sweep is a function of time; everything else follows scroll. */
  time: number;
  /** Reduced motion: a static line and markers — no travelling light, parallax or sweep. */
  still: boolean;
  compact: boolean;
  /** The site's mono family, for canvas text. */
  mono: string;
}

export const toCss = (rgb: Rgb) => `rgb(${Math.round(rgb[0])}, ${Math.round(rgb[1])}, ${Math.round(rgb[2])})`;

/* Colours are set once as opaque strings and faded with globalAlpha, so frames build no strings. */
export const INK = {
  steel: toCss(STEEL),
  bone: toCss(BONE),
  red: toCss(RED),
  yellow: toCss(YELLOW),
} as const;
