"use client";

import { useEffect, useRef } from "react";
import { RIPPLE_GEOMETRY } from "@/components/figures/builds/RippleFigure";
import { clamp01, smoothstep } from "@/lib/motion";
import { PROGRAMME_PALETTE } from "../theme";
import { bleed, fitCanvas, isPhone, parseRgb, rgba, scrub } from "./scrub";

/**
 * Ripple's signature: the change itself, travelling. As the programme arrives, the CGPA fact
 * in the figure takes its new value and two damped waves leave it — wave 1, then wave 2 — and
 * cross the whole section. A lattice of points lifts and falls as each front passes, like a
 * surface carrying a wave, and the figure's belief graph lights in step: a belief is reached
 * when the front that carries its wave reaches it. Then the water goes still and the figure's
 * own two wave fronts are what remain.
 *
 * Scroll-scrubbed and reversible; the figure follows through `data-ripple-step` and a
 * `ripple:step` event on the programme root.
 */

const PRIMARY = parseRgb(PROGRAMME_PALETTE.ripple.primary);
const EMBER = parseRgb(PROGRAMME_PALETTE.ripple.secondary);

/** The two fronts, in progress units: when each leaves the fact and when it has crossed the section. */
const FRONTS = [
  { emit: 0.12, cross: 0.66, ink: PRIMARY, gain: 1 },
  { emit: 0.36, cross: 0.94, ink: EMBER, gain: 0.85 },
] as const;

/** Rings behind each front: a damped wave train, each ring weaker than the one before it. */
const TRAIN = 5;

interface Scene {
  ctx: CanvasRenderingContext2D;
  width: number;
  height: number;
  /** The fact, in canvas coordinates. */
  ox: number;
  oy: number;
  /** Screen pixels per figure unit. */
  scale: number;
  /** Farthest the waves need to travel to leave the canvas. */
  reach: number;
  /** Lattice points as x, y, distance to the fact, unit vector from the fact. */
  lattice: Float32Array;
}

function frontRadius(front: (typeof FRONTS)[number], p: number, reach: number) {
  if (p <= front.emit) return -1;
  return ((p - front.emit) / (front.cross - front.emit)) * reach;
}

/** Amplitude of a front that has travelled `r` pixels: spreading loss plus damping. */
const amplitude = (r: number, reach: number) => (1 / Math.sqrt(1 + r / 220)) * Math.exp((-0.75 * r) / reach);

/** Wavelength grows a little as the train travels — the long waves outrun the short ones. */
const wavelength = (r: number) => 26 + 0.03 * r;

/** Which step of the figure's play-through the waves have reached. */
function stepAt(p: number, scene: Scene): number {
  if (p < 0.05) return 0;
  const { rx: wave1 } = RIPPLE_GEOMETRY.waves[1];
  const { rx: wave2 } = RIPPLE_GEOMETRY.waves[2];
  const r1 = frontRadius(FRONTS[0], p, scene.reach);
  const r2 = frontRadius(FRONTS[1], p, scene.reach);
  if (r2 >= (wave2 + 40) * scene.scale) return 5;
  if (r2 >= wave1 * scene.scale) return 4;
  if (r1 >= (wave1 * 2) * scene.scale) return 3;
  if (r1 >= wave1 * scene.scale) return 2;
  return 1;
}

function draw(scene: Scene, p: number) {
  const { ctx, width, height, ox, oy, reach, lattice } = scene;
  ctx.clearRect(0, 0, width, height);

  // The water is still before the change and after it has passed.
  const presence = smoothstep(0.0, 0.08, p) * (1 - smoothstep(0.9, 1, p));
  if (presence <= 0.001) return;

  const radii = FRONTS.map((front) => frontRadius(front, p, reach));
  const amps = radii.map((r, k) => (r < 0 ? 0 : amplitude(r, reach) * FRONTS[k].gain));

  // The fact taking its new value: a short glow at the source.
  const intake = smoothstep(0.03, 0.1, p) * (1 - smoothstep(0.12, 0.3, p));
  if (intake > 0.01) {
    const glow = ctx.createRadialGradient(ox, oy, 0, ox, oy, 70);
    glow.addColorStop(0, rgba(EMBER, 0.45 * intake));
    glow.addColorStop(1, rgba(EMBER, 0));
    ctx.fillStyle = glow;
    ctx.fillRect(ox - 70, oy - 70, 140, 140);
  }

  // The lattice: each point displaced along the line from the fact, lit by how far it moves.
  const lift = width < 768 ? 6 : 9;
  for (let i = 0; i < lattice.length; i += 5) {
    const x = lattice[i];
    const y = lattice[i + 1];
    const d = lattice[i + 2];
    let disp = 0;
    let warm = 0;
    for (let k = 0; k < FRONTS.length; k++) {
      const r = radii[k];
      if (r < 0) continue;
      const lambda = wavelength(r);
      const s = d - r;
      if (s > lambda || s < -lambda * TRAIN) continue;
      // A wave train trailing its front: a decaying sinusoid under a smooth envelope.
      const envelope = Math.exp(-(((s + lambda * 1.2) / (lambda * 2.1)) ** 2));
      const v = amps[k] * envelope * Math.cos((2 * Math.PI * s) / lambda);
      disp += v;
      if (k === 1) warm += Math.abs(v);
    }
    const energy = Math.min(1, Math.abs(disp));
    const alpha = presence * (0.05 + 0.95 * energy);
    if (alpha < 0.02) continue;
    const px = x + lattice[i + 3] * disp * lift;
    const py = y + lattice[i + 4] * disp * lift;
    const ink = warm > energy * 0.5 ? EMBER : PRIMARY;
    const size = 1.2 + 1.8 * energy;
    ctx.fillStyle = rgba(ink, alpha);
    ctx.fillRect(px - size / 2, py - size / 2, size, size);
  }

  // The rings themselves: each front and the weaker rings that trail it.
  ctx.lineCap = "round";
  for (let k = 0; k < FRONTS.length; k++) {
    const r = radii[k];
    if (r < 0) continue;
    const lambda = wavelength(r);
    for (let ring = 0; ring < TRAIN; ring++) {
      const radius = r - ring * lambda;
      if (radius <= 2) break;
      const a = presence * amps[k] * Math.exp(-0.62 * ring) * (ring === 0 ? 0.85 : 0.5);
      if (a < 0.015) continue;
      ctx.strokeStyle = rgba(FRONTS[k].ink, a);
      ctx.lineWidth = ring === 0 ? 1.4 : 1;
      ctx.beginPath();
      ctx.arc(ox, oy, radius, 0, Math.PI * 2);
      ctx.stroke();
    }
  }
}

export function RippleField() {
  const canvasRef = useRef<HTMLCanvasElement>(null);

  useEffect(() => {
    const canvas = canvasRef.current;
    const host = canvas?.parentElement;
    const programme = canvas?.closest<HTMLElement>("[data-programme]");
    const ctx = canvas?.getContext("2d");
    if (!canvas || !host || !programme || !ctx) return;

    let scene: Scene | null = null;
    let step = -1;

    const measure = (): boolean => {
      bleed(canvas, host);
      const svg = programme.querySelector<SVGSVGElement>("[data-ripple-engine]");
      if (!svg) return false;
      const { width, height } = fitCanvas(canvas, ctx, isPhone() ? 1 : 1.5);
      if (width === 0 || height === 0) return false;
      const box = canvas.getBoundingClientRect();
      const art = svg.getBoundingClientRect();
      const scale = art.width / RIPPLE_GEOMETRY.width;
      const ox = art.left - box.left + RIPPLE_GEOMETRY.fx * scale;
      const oy = art.top - box.top + RIPPLE_GEOMETRY.fy * scale;
      const reach = Math.max(Math.hypot(width - ox, height * 0.5), Math.hypot(ox, height * 0.5));

      const spacing = isPhone() ? 22 : 26;
      const points: number[] = [];
      for (let y = spacing / 2; y < height; y += spacing)
        for (let x = spacing / 2; x < width; x += spacing) {
          const dx = x - ox;
          const dy = y - oy;
          const d = Math.hypot(dx, dy) || 1;
          points.push(x, y, d, dx / d, dy / d);
        }
      // Distances and directions are stored, so a frame takes no square root per point.
      scene = { ctx, width, height, ox, oy, scale, reach, lattice: new Float32Array(points) };
      return true;
    };

    const progress = () => {
      if (!scene) return 0;
      const top = canvas.getBoundingClientRect().top + scene.oy;
      const vh = window.innerHeight;
      // The fact enters near the bottom of the view; the waves have settled by the time it is
      // a third of the way down.
      return clamp01((0.94 * vh - top) / (0.62 * vh));
    };

    const publish = (next: number) => {
      if (next === step) return;
      step = next;
      programme.dataset.rippleStep = String(next);
      programme.dispatchEvent(new CustomEvent("ripple:step", { detail: next }));
    };

    const stop = scrub(host, {
      measure,
      progress,
      draw: (p, still) => {
        if (!scene) return;
        if (still) {
          scene.ctx.clearRect(0, 0, scene.width, scene.height);
          return;
        }
        draw(scene, p);
        publish(stepAt(p, scene));
      },
    });
    return () => {
      stop();
      delete programme.dataset.rippleStep;
    };
  }, []);

  return <canvas ref={canvasRef} className="sig-layer sig-ripple" aria-hidden="true" />;
}
