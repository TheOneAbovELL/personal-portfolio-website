import { smoothstep } from "@/lib/motion";
import type { RaceLayout, Rgb } from "./layout";
import type { ZoneId } from "./store";

/**
 * Atmosphere: what each zone's room looks like, and how one room becomes the next.
 *
 * Colour arrives as light — two low-alpha glows over a dark base — so every value here is a
 * number that can be interpolated; nothing switches. The result is written to custom
 * properties on `.race-env` (styles/race.css paints them).
 */

/* Accents as numbers: canvas and gradients cannot read the tokens in globals.css directly.
   Ferrari-led: rosso is the signature light, champagne the detail, silver the cool neutral. */
export const ROSSO: Rgb = [200, 16, 46];
/** Rosso at hairline widths needs the brighter tone to stay visible, exactly as it does for text. */
export const ROSSO_BRIGHT: Rgb = [255, 74, 85];
export const CHAMPAGNE: Rgb = [201, 169, 110];
export const SILVER: Rgb = [207, 211, 214];
export const STEEL: Rgb = [163, 156, 148];
export const BONE: Rgb = [239, 235, 228];

interface Light {
  rgb: Rgb;
  alpha: number;
  /** Centre of the glow, in percent of the viewport. */
  x: number;
  y: number;
}

interface Palette {
  /** The room: `deep` at the top of the viewport settling into `base`. */
  base: Rgb;
  deep: Rgb;
  a: Light;
  b: Light;
  /** The colour the racing line is lit in. */
  accent: Rgb;
}

/** An atmosphere is a flat vector so blending and easing are simple loops. */
export type Atmosphere = Float32Array;

const BASE = 0;
const DEEP = 3;
const A_RGB = 6;
const A_ALPHA = 9;
const A_X = 10;
const A_Y = 11;
const B_RGB = 12;
const B_ALPHA = 15;
const B_X = 16;
const B_Y = 17;
const ACCENT = 18;
const SIZE = 21;

const pack = (p: Palette): Atmosphere =>
  Float32Array.of(
    ...p.base,
    ...p.deep,
    ...p.a.rgb,
    p.a.alpha,
    p.a.x,
    p.a.y,
    ...p.b.rgb,
    p.b.alpha,
    p.b.x,
    p.b.y,
    ...p.accent,
  );

/** RACE-SYSTEM §5. Lights change side from room to room, so a boundary reads as light moving.
 *  Every room is warm graphite; colour is rationed — rosso where it matters, champagne for detail. */
const PALETTES: Record<ZoneId, Atmosphere> = {
  // Automotive studio — matches the resting values in race.css.
  hero: pack({
    base: [11, 10, 10],
    deep: [21, 18, 17],
    a: { rgb: CHAMPAGNE, alpha: 0.05, x: 12, y: 30 },
    b: { rgb: ROSSO, alpha: 0.06, x: 88, y: 74 },
    accent: ROSSO_BRIGHT,
  }),
  // Quiet studio.
  about: pack({
    base: [11, 10, 10],
    deep: [19, 17, 16],
    a: { rgb: SILVER, alpha: 0.045, x: 8, y: 34 },
    b: { rgb: CHAMPAGNE, alpha: 0.04, x: 92, y: 70 },
    accent: CHAMPAGNE,
  }),
  // Control room.
  capabilities: pack({
    base: [10, 9, 9],
    deep: [20, 17, 16],
    a: { rgb: CHAMPAGNE, alpha: 0.055, x: 86, y: 24 },
    b: { rgb: ROSSO, alpha: 0.035, x: 10, y: 80 },
    accent: CHAMPAGNE,
  }),
  // Briefing room: a cool key light and a low red fill.
  ask: pack({
    base: [12, 10, 10],
    deep: [23, 19, 18],
    a: { rgb: SILVER, alpha: 0.05, x: 14, y: 36 },
    b: { rgb: ROSSO, alpha: 0.045, x: 90, y: 78 },
    accent: SILVER,
  }),
  // Engineering lab. Light A is re-tinted programme by programme (see `data-race-light`).
  work: pack({
    base: [11, 10, 10],
    deep: [19, 17, 16],
    a: { rgb: SILVER, alpha: 0.06, x: 88, y: 26 },
    b: { rgb: ROSSO, alpha: 0.035, x: 8, y: 80 },
    accent: SILVER,
  }),
  // Behind the document sheet. Neutral, so the rooms either side fade down toward it and back up.
  experience: pack({
    base: [11, 10, 10],
    deep: [17, 15, 15],
    a: { rgb: STEEL, alpha: 0.03, x: 50, y: 28 },
    b: { rgb: STEEL, alpha: 0.022, x: 50, y: 76 },
    accent: STEEL,
  }),
  // Workshop: warm graphite walls, a champagne work-light overhead.
  garage: pack({
    base: [19, 17, 16],
    deep: [33, 29, 27],
    a: { rgb: CHAMPAGNE, alpha: 0.075, x: 22, y: 14 },
    b: { rgb: STEEL, alpha: 0.055, x: 86, y: 68 },
    accent: CHAMPAGNE,
  }),
  // Night pit lane: warm dark, rosso low on the horizon.
  contact: pack({
    base: [14, 10, 10],
    deep: [28, 15, 15],
    a: { rgb: ROSSO, alpha: 0.14, x: 72, y: 84 },
    b: { rgb: CHAMPAGNE, alpha: 0.05, x: 12, y: 18 },
    accent: ROSSO_BRIGHT,
  }),
};

/** Routes without zones (the work index, case studies) sit in the engineering lab. */
const OFF_TRACK = PALETTES.work;

/** Rooms cross-fade over this many viewport heights either side of a boundary. */
const BLEND_REACH = 0.45;
/** Programme lights fade in and out over this many viewport heights at their edges. */
const LIGHT_REACH = 0.2;

export const createAtmosphere = (): Atmosphere => new Float32Array(SIZE);

function accumulate(out: Atmosphere, palette: Atmosphere, weight: number): void {
  if (weight <= 0) return;
  for (let i = 0; i < SIZE; i++) out[i] += palette[i] * weight;
}

function tint(out: Atmosphere, offset: number, rgb: readonly number[], weight: number): void {
  for (let i = 0; i < 3; i++) out[offset + i] += (rgb[i] - out[offset + i]) * weight;
}

/** The atmosphere for a reading-line position: the zone's palette, blended across boundaries. */
export function atmosphereAt(layout: RaceLayout, readY: number, out: Atmosphere): void {
  const { zones, lights, height } = layout;
  if (zones.length === 0) {
    out.set(OFF_TRACK);
    return;
  }

  let k = 0;
  for (let i = 1; i < zones.length; i++) if (zones[i].top <= readY) k = i;
  const band = height * BLEND_REACH;
  const fromPrev = k > 0 ? 1 - smoothstep(-band, band, readY - zones[k].top) : 0;
  const toNext = k < zones.length - 1 ? smoothstep(-band, band, readY - zones[k + 1].top) : 0;

  out.fill(0);
  accumulate(out, PALETTES[zones[k].id], 1 - fromPrev - toNext);
  if (fromPrev > 0) accumulate(out, PALETTES[zones[k - 1].id], fromPrev);
  if (toNext > 0) accumulate(out, PALETTES[zones[k + 1].id], toNext);

  // Programme lighting: elements carrying data-race-light re-tint light A (and the line)
  // while they span the reading line. Adjacent elements cross-fade into each other.
  const edge = height * LIGHT_REACH;
  let total = 0;
  let r = 0;
  let g = 0;
  let b = 0;
  for (const light of lights) {
    const weight = smoothstep(-edge, edge, readY - light.top) * (1 - smoothstep(-edge, edge, readY - light.bottom));
    if (weight <= 0) continue;
    total += weight;
    r += light.rgb[0] * weight;
    g += light.rgb[1] * weight;
    b += light.rgb[2] * weight;
  }
  if (total > 0) {
    const rgb = [r / total, g / total, b / total];
    const weight = Math.min(1, total);
    tint(out, A_RGB, rgb, weight);
    tint(out, ACCENT, rgb, weight);
  }
}

/** Eases `shown` toward `target`; returns the largest remaining difference, normalised to 0 → 1. */
export function easeAtmosphere(shown: Atmosphere, target: Atmosphere, keep: number): number {
  let remaining = 0;
  for (let i = 0; i < SIZE; i++) {
    shown[i] = target[i] + (shown[i] - target[i]) * keep;
    const isAlpha = i === A_ALPHA || i === B_ALPHA;
    const isPosition = i === A_X || i === A_Y || i === B_X || i === B_Y;
    const scale = isAlpha ? 0.2 : isPosition ? 100 : 255;
    remaining = Math.max(remaining, Math.abs(shown[i] - target[i]) / scale);
  }
  return remaining;
}

export const accentOf = (atmosphere: Atmosphere): Rgb => [
  atmosphere[ACCENT],
  atmosphere[ACCENT + 1],
  atmosphere[ACCENT + 2],
];

const triplet = (v: Atmosphere, at: number) => `${Math.round(v[at])} ${Math.round(v[at + 1])} ${Math.round(v[at + 2])}`;
const percent = (value: number) => `${value.toFixed(1)}%`;

const PROPERTIES: readonly [name: string, format: (v: Atmosphere) => string][] = [
  ["--env-base", (v) => `rgb(${triplet(v, BASE)})`],
  ["--env-deep", (v) => `rgb(${triplet(v, DEEP)})`],
  ["--env-glow-a", (v) => triplet(v, A_RGB)],
  ["--env-glow-a-alpha", (v) => v[A_ALPHA].toFixed(3)],
  ["--env-glow-a-x", (v) => percent(v[A_X])],
  ["--env-glow-a-y", (v) => percent(v[A_Y])],
  ["--env-glow-b", (v) => triplet(v, B_RGB)],
  ["--env-glow-b-alpha", (v) => v[B_ALPHA].toFixed(3)],
  ["--env-glow-b-x", (v) => percent(v[B_X])],
  ["--env-glow-b-y", (v) => percent(v[B_Y])],
];

/**
 * Writes an atmosphere to the environment element. `written` remembers the last value of each
 * property, so a frame in the middle of a zone — where nothing changes — touches no styles.
 */
export function writeAtmosphere(env: HTMLElement, atmosphere: Atmosphere, written: string[]): void {
  for (let i = 0; i < PROPERTIES.length; i++) {
    const [name, format] = PROPERTIES[i];
    const value = format(atmosphere);
    if (written[i] === value) continue;
    written[i] = value;
    env.style.setProperty(name, value);
  }
}

/** Hands the element back to the resting values in race.css. */
export function clearAtmosphere(env: HTMLElement): void {
  for (const [name] of PROPERTIES) env.style.removeProperty(name);
}
