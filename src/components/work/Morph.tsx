"use client";

import { useEffect, useRef } from "react";
import { clamp01, easeInOutCubic, lerp, smoothstep } from "@/lib/motion";
import { MORPHS, NODE_STOPS, wordLengths, type MorphGeometry, type MorphKind, type MorphShape } from "./morph-shapes";
import type { ProgrammePalette, RgbTriplet } from "./theme";

/**
 * DATA_MORPH — the transition between two programmes (docs/RACE-SYSTEM.md §8).
 *
 * One set of lines, scrubbed by scroll through three named states (see morph-shapes.ts), in
 * the outgoing programme's colours at the top and the incoming programme's at the bottom. It
 * is driven entirely by where the band sits in the viewport, so it runs backwards when the
 * page does and holds still when the page does.
 *
 * Cost: nothing while off screen. On screen it draws one frame per scroll event at most —
 * there is no free-running loop, because nothing here moves on its own.
 */

interface Density {
  lines: number;
  samples: number;
  detail: number;
  maxDpr: number;
}

const DESKTOP: Density = { lines: 14, samples: 301, detail: 1, maxDpr: 2 };
/** Phones get fewer, simpler lines at DPR 1 (§10): the band is shorter and the GPU is smaller. */
const MOBILE: Density = { lines: 9, samples: 151, detail: 0.45, maxDpr: 1 };
const MOBILE_QUERY = "(max-width: 767px)";

/** Vertical inset of the drawing area, as a share of the band's height. */
const INSET = 0.06;
/** How far the last line trails the first through a change of state: the set moves as a wave. */
const STAGGER = 0.45;
/** Progress at which the first state lets go, the middle one is held, and the last arrives. */
const KEY = { release: 0.16, holdFrom: 0.45, holdTo: 0.55, arrive: 0.84 } as const;
const WORD_GAP = 8;

type Rgb = readonly [number, number, number];

const parse = (triplet: RgbTriplet): Rgb => {
  const [r, g, b] = triplet.split(" ").map(Number);
  return [r, g, b];
};

const mix = (a: Rgb, b: Rgb, t: number): Rgb => [lerp(a[0], b[0], t), lerp(a[1], b[1], t), lerp(a[2], b[2], t)];

interface Inks {
  from: { primary: Rgb; secondary: Rgb };
  to: { primary: Rgb; secondary: Rgb };
}

interface Scene {
  ctx: CanvasRenderingContext2D;
  width: number;
  height: number;
  geometry: MorphGeometry;
  shapes: MorphShape[];
  words: number[][];
}

/** Which pair of states `progress` falls between, and how far through the change it is. */
function locate(progress: number): { segment: 0 | 1; t: number } {
  if (progress < KEY.holdFrom) {
    return { segment: 0, t: clamp01((progress - KEY.release) / (KEY.holdFrom - KEY.release)) };
  }
  return { segment: 1, t: clamp01((progress - KEY.holdTo) / (KEY.arrive - KEY.holdTo)) };
}

/** How far the outgoing programme's colour has given way to the incoming one. */
const inkBlend = (progress: number) => smoothstep(0.22, 0.78, progress);

function draw(scene: Scene, progress: number, inks: Inks): void {
  const { ctx, width, height, geometry, shapes, words } = scene;
  const { lines, samples } = geometry;
  const { segment, t } = locate(progress);
  const a = shapes[segment];
  const b = shapes[segment + 1];
  const blend = inkBlend(progress);
  const top = height * INSET;
  const inner = height - top * 2;

  const ink = (tone: number): Rgb =>
    mix(mix(inks.from.primary, inks.from.secondary, tone), mix(inks.to.primary, inks.to.secondary, tone), blend);
  const eased = (line: number) =>
    easeInOutCubic(clamp01(t * (1 + STAGGER) - STAGGER * (line / (lines - 1))));

  ctx.clearRect(0, 0, width, height);
  ctx.lineJoin = "round";
  ctx.lineCap = "butt";

  for (let line = 0; line < lines; line++) {
    const ti = eased(line);
    const alpha = lerp(a.alpha[line], b.alpha[line], ti);
    const [r, g, bl] = ink(lerp(a.tone[line], b.tone[line], ti));
    // Word gaps close early in the change, so text has become line before it starts to bend.
    const gap = WORD_GAP * lerp(a.words, b.words, clamp01(ti * 2.5));

    ctx.strokeStyle = `rgb(${r} ${g} ${bl} / ${alpha})`;
    ctx.lineWidth = 1 + 0.5 * alpha;
    ctx.setLineDash(gap > 0.25 ? words[line].flatMap((word) => [word, gap]) : []);
    ctx.beginPath();
    const base = line * samples * 2;
    for (let k = 0; k < samples; k++) {
      const offset = base + k * 2;
      const x = lerp(a.points[offset], b.points[offset], ti) * width;
      const y = top + lerp(a.points[offset + 1], b.points[offset + 1], ti) * inner;
      if (k === 0) ctx.moveTo(x, y);
      else ctx.lineTo(x, y);
    }
    ctx.stroke();
  }

  // Junctions of the retrieval graph. Many lines share a junction, so each is drawn once.
  const nodes = lerp(a.nodes, b.nodes, easeInOutCubic(t));
  if (nodes > 0.01) {
    const seen = new Set<number>();
    ctx.setLineDash([]);
    for (let line = 0; line < lines; line++) {
      const ti = eased(line);
      const tone = lerp(a.tone[line], b.tone[line], ti);
      NODE_STOPS.forEach((stop, layer) => {
        const offset = (line * samples + Math.round(stop * (samples - 1))) * 2;
        const x = Math.round(lerp(a.points[offset], b.points[offset], ti) * width);
        const y = Math.round(top + lerp(a.points[offset + 1], b.points[offset + 1], ti) * inner);
        const key = x * 8192 + y;
        if (seen.has(key)) return;
        seen.add(key);
        // Sources are small; the junctions they feed are larger. Only a source keeps its line's tone.
        const size = layer === 0 ? 3 : 5;
        const [r, g, bl] = ink(layer === 0 ? tone : 0);
        ctx.fillStyle = `rgb(${r} ${g} ${bl} / ${nodes})`;
        ctx.fillRect(x - size / 2, y - size / 2, size, size);
      });
    }
  }
}

/** 0 as the band comes into view from below, 1 as it leaves at the top. */
function scrollProgress(element: HTMLElement): number {
  const rect = element.getBoundingClientRect();
  const viewport = window.innerHeight;
  const centre = rect.top + rect.height / 2;
  // Mapped over the stretch where the band is mostly visible, so no state plays out unseen.
  return clamp01((0.88 * viewport - centre) / (0.76 * viewport));
}

/**
 * Development only: `?morph=0.5` pins every transition to that progress, so each state can be
 * inspected (and captured headlessly) without scrolling.
 */
function pinnedProgress(): number | null {
  if (process.env.NODE_ENV === "production") return null;
  const raw = new URLSearchParams(window.location.search).get("morph");
  if (raw === null) return null;
  const value = Number(raw);
  return Number.isFinite(value) ? clamp01(value) : null;
}

interface MorphProps {
  kind: MorphKind;
  /** The programme being left. */
  from: ProgrammePalette;
  /** The programme (or the neutral page) being entered. */
  to: ProgrammePalette;
}

export function Morph({ kind, from, to }: MorphProps) {
  const rootRef = useRef<HTMLDivElement>(null);
  const canvasRef = useRef<HTMLCanvasElement>(null);
  const spec = MORPHS[kind];
  const { primary: fromPrimary, secondary: fromSecondary } = from;
  const { primary: toPrimary, secondary: toSecondary } = to;

  useEffect(() => {
    const root = rootRef.current;
    const canvas = canvasRef.current;
    const ctx = canvas?.getContext("2d");
    if (!root || !canvas || !ctx) return;

    const inks: Inks = {
      from: { primary: parse(fromPrimary), secondary: parse(fromSecondary) },
      to: { primary: parse(toPrimary), secondary: parse(toSecondary) },
    };
    const reduced = window.matchMedia("(prefers-reduced-motion: reduce)");
    const pinned = pinnedProgress();
    // Reduced motion: a static mid-state, no scrubbing (§10).
    const scrubbed = () => pinned === null && !reduced.matches;

    let scene: Scene | null = null;
    let frame = 0;
    let visible = false;
    let listening = false;
    let drawn = -1;

    const measure = (): Scene | null => {
      const width = canvas.clientWidth;
      const height = canvas.clientHeight;
      if (width === 0 || height === 0) return null;
      const density = window.matchMedia(MOBILE_QUERY).matches ? MOBILE : DESKTOP;
      const dpr = Math.min(window.devicePixelRatio || 1, density.maxDpr);
      canvas.width = Math.round(width * dpr);
      canvas.height = Math.round(height * dpr);
      ctx.setTransform(dpr, 0, 0, dpr, 0, 0);
      const geometry: MorphGeometry = {
        lines: density.lines,
        samples: density.samples,
        detail: density.detail,
        aspect: width / (height * (1 - INSET * 2)),
      };
      return {
        ctx,
        width,
        height,
        geometry,
        shapes: MORPHS[kind].build.map((build) => build(geometry)),
        words: Array.from({ length: density.lines }, (_, line) => wordLengths(line)),
      };
    };

    const render = () => {
      frame = 0;
      if (!scene) return;
      const progress = pinned ?? (reduced.matches ? 0.5 : scrollProgress(root));
      if (Math.abs(progress - drawn) < 0.0004) return;
      drawn = progress;
      draw(scene, progress, inks);

      // The rail: a lit stretch travels along it and the nearest state's name lights up.
      const [r, g, b] = mix(inks.from.primary, inks.to.primary, inkBlend(progress));
      root.style.setProperty("--morph-ink", `${Math.round(r)} ${Math.round(g)} ${Math.round(b)}`);
      root.style.setProperty("--morph-p", progress.toFixed(4));
      const state = progress < 0.3 ? "0" : progress < 0.7 ? "1" : "2";
      if (root.dataset.state !== state) root.dataset.state = state;
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
    const onMotionPreference = () => {
      listen(visible && scrubbed());
      redraw();
    };

    const resizeObserver = new ResizeObserver(() => {
      scene = measure();
      redraw();
    });
    resizeObserver.observe(canvas);

    const intersectionObserver = new IntersectionObserver(
      ([entry]) => {
        visible = entry.isIntersecting;
        listen(visible && scrubbed());
        if (visible) schedule();
        else if (frame) {
          cancelAnimationFrame(frame);
          frame = 0;
        }
      },
      { rootMargin: "10% 0px" },
    );
    intersectionObserver.observe(root);
    reduced.addEventListener("change", onMotionPreference);

    return () => {
      resizeObserver.disconnect();
      intersectionObserver.disconnect();
      reduced.removeEventListener("change", onMotionPreference);
      listen(false);
      if (frame) cancelAnimationFrame(frame);
    };
  }, [kind, fromPrimary, fromSecondary, toPrimary, toSecondary]);

  return (
    <div
      ref={rootRef}
      className="morph"
      aria-hidden="true"
      data-state="1"
      style={{ "--morph-ink": fromPrimary, "--morph-p": 0.5 } as React.CSSProperties}
    >
      <canvas ref={canvasRef} className="morph-canvas" />
      <div className="shell">
        <div className="morph-rail">
          <span className="morph-lit" />
        </div>
        <p className="morph-states label">
          {spec.states.map((state) => (
            <span key={state}>{state}</span>
          ))}
        </p>
      </div>
    </div>
  );
}
