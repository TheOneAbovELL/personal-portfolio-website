import { clamp01 } from "@/lib/motion";

/**
 * The machinery every programme signature shares (Ripple's waves, SatQuery's pass, ARGUS's
 * tape): a drawing that is a pure function of scroll position. It runs backwards when the
 * page does and holds still when the page does — there is no free-running loop.
 *
 * Cost: nothing while off screen. On screen, at most one frame per scroll event. Under
 * reduced motion the drawing is made once at its settled state (usually blank) and never
 * scrubbed.
 */

export interface ScrubHandlers {
  /** Layout changed: re-measure, size the canvas. Return false if there is nothing to draw. */
  measure: () => boolean;
  /** 0 → 1 for the current scroll position. Called once per frame while visible. */
  progress: () => number;
  /** Draw the state at `p`. `still` is true under reduced motion. */
  draw: (p: number, still: boolean) => void;
}

export interface ScrubOptions {
  /** Progress drawn under reduced motion. */
  restingProgress?: number;
}

/**
 * Development only: `?sig=0.5` pins every signature to that progress, so each state can be
 * inspected (and captured headlessly) without scrolling.
 */
function pinned(): number | null {
  if (process.env.NODE_ENV === "production") return null;
  const raw = new URLSearchParams(window.location.search).get("sig");
  if (raw === null) return null;
  const value = Number(raw);
  return Number.isFinite(value) ? clamp01(value) : null;
}

export function scrub(watch: Element, handlers: ScrubHandlers, { restingProgress = 1 }: ScrubOptions = {}): () => void {
  const reduced = window.matchMedia("(prefers-reduced-motion: reduce)");
  const pin = pinned();
  let ready = false;
  let visible = false;
  let listening = false;
  let frame = 0;
  let drawn = -1;

  const render = () => {
    frame = 0;
    if (!ready) return;
    const still = reduced.matches;
    const p = pin ?? (still ? restingProgress : clamp01(handlers.progress()));
    if (Math.abs(p - drawn) < 0.0002) return;
    drawn = p;
    handlers.draw(p, still);
  };

  const schedule = () => {
    if (!frame && visible) frame = requestAnimationFrame(render);
  };

  const redraw = () => {
    drawn = -1;
    schedule();
  };

  const listen = (on: boolean) => {
    if (on === listening) return;
    listening = on;
    if (on) window.addEventListener("scroll", schedule, { passive: true });
    else window.removeEventListener("scroll", schedule);
  };

  const resizeObserver = new ResizeObserver(() => {
    ready = handlers.measure();
    redraw();
  });
  resizeObserver.observe(watch);
  const onWindowResize = () => {
    ready = handlers.measure();
    redraw();
  };
  window.addEventListener("resize", onWindowResize);

  const intersectionObserver = new IntersectionObserver(
    ([entry]) => {
      visible = entry.isIntersecting;
      listen(visible && pin === null && !reduced.matches);
      if (visible) redraw();
      else if (frame) {
        cancelAnimationFrame(frame);
        frame = 0;
      }
    },
    { rootMargin: "25% 0px" },
  );
  intersectionObserver.observe(watch);

  const onMotionPreference = () => {
    listen(visible && pin === null && !reduced.matches);
    redraw();
  };
  reduced.addEventListener("change", onMotionPreference);

  return () => {
    resizeObserver.disconnect();
    intersectionObserver.disconnect();
    window.removeEventListener("resize", onWindowResize);
    reduced.removeEventListener("change", onMotionPreference);
    listen(false);
    if (frame) cancelAnimationFrame(frame);
  };
}

/** Sizes a canvas to its CSS box at a capped device-pixel ratio and returns its CSS size. */
export function fitCanvas(canvas: HTMLCanvasElement, ctx: CanvasRenderingContext2D, maxDpr: number) {
  const width = canvas.clientWidth;
  const height = canvas.clientHeight;
  const dpr = Math.min(window.devicePixelRatio || 1, maxDpr);
  const w = Math.max(1, Math.round(width * dpr));
  const h = Math.max(1, Math.round(height * dpr));
  if (canvas.width !== w) canvas.width = w;
  if (canvas.height !== h) canvas.height = h;
  ctx.setTransform(dpr, 0, 0, dpr, 0, 0);
  return { width, height, dpr };
}

/**
 * Stretches an absolutely positioned layer across the whole viewport width, whatever column
 * its parent sits in — the signatures run across the section, not inside the figure's box.
 */
export function bleed(layer: HTMLElement, parent: HTMLElement): void {
  const left = parent.getBoundingClientRect().left;
  const width = document.documentElement.clientWidth;
  layer.style.left = `${-left}px`;
  layer.style.width = `${width}px`;
}

export const isPhone = () => window.matchMedia("(max-width: 767px)").matches;

export type Rgb = readonly [number, number, number];

export const parseRgb = (triplet: string): Rgb => {
  const [r, g, b] = triplet.trim().split(/\s+/).map(Number);
  return [r, g, b];
};

export const rgba = ([r, g, b]: Rgb, a: number) => `rgba(${r},${g},${b},${a})`;
