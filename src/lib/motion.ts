/**
 * Motion tokens. The CSS custom properties in globals.css mirror these values;
 * anything animated from JavaScript should use them rather than ad-hoc numbers.
 */
export const duration = {
  fast: 180,
  base: 480,
  slow: 900,
  /** Hero drawing → object transition. */
  cinematic: 2200,
} as const;

export const clamp01 = (v: number) => (v < 0 ? 0 : v > 1 ? 1 : v);

export const clamp = (v: number, min: number, max: number) => (v < min ? min : v > max ? max : v);

export const lerp = (a: number, b: number, t: number) => a + (b - a) * t;

/**
 * Frame-rate-independent easing toward a target: after `tau` seconds about 63% of the gap is
 * closed, whatever the frame time. Used for inertia (scroll energy, atmosphere colour).
 */
export const damp = (current: number, target: number, tau: number, dt: number) =>
  target + (current - target) * Math.exp(-dt / tau);

/** Matches --ease-in-out closely; used for camera moves. */
export const easeInOutCubic = (t: number) => (t < 0.5 ? 4 * t * t * t : 1 - (-2 * t + 2) ** 3 / 2);

export const easeOutExpo = (t: number) => (t >= 1 ? 1 : 1 - 2 ** (-10 * t));

export const smoothstep = (edge0: number, edge1: number, x: number) => {
  const t = clamp01((x - edge0) / (edge1 - edge0));
  return t * t * (3 - 2 * t);
};

export const prefersReducedMotion = () =>
  typeof window !== "undefined" && window.matchMedia("(prefers-reduced-motion: reduce)").matches;
