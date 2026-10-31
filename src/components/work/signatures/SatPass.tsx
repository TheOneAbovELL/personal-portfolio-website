"use client";

import { useEffect, useRef } from "react";
import { clamp01, lerp, smoothstep } from "@/lib/motion";
import { PROGRAMME_PALETTE } from "../theme";
import { bleed, fitCanvas, isPhone, parseRgb, rgba, scrub, type Rgb } from "./scrub";

/**
 * SatQuery AI's signature: a satellite pass. A scan swath, leaning on its ground track,
 * sweeps across the section. Where it has passed, the ground comes down as a raster mosaic —
 * coarse tiles first, each one resolving to finer and finer cells as more of it is read — and
 * the figure itself is uncovered behind the swath's trailing edge. Once a tile has resolved it
 * clears, so what is left is the figure, read.
 *
 * The mosaic is generated terrain, drawn as imagery is drawn; it is not satellite data.
 * Scroll-scrubbed and reversible.
 */

const TRACK = parseRgb(PROGRAMME_PALETTE.orbital.primary);
const CHLOROPHYLL = parseRgb(PROGRAMME_PALETTE.orbital.secondary);

/** The swath leans off vertical, as a swath does when the orbit is inclined to the frame. */
const LEAN = Math.tan((9 * Math.PI) / 180);
/** Progress over which the swath crosses the section. */
const SWEEP = { from: 0.04, to: 0.66 } as const;
/** Progress a tile takes from first coarse read to cleared. */
const RESOLVE = 0.24;
/** Block size (px) at each level of resolution, as a divisor of the tile. */
const LEVELS = [1, 2, 4, 8] as const;

/** Stable hash of two integers in [0, 1). */
function hash2(x: number, y: number): number {
  let h = (x * 374761393 + y * 668265263) | 0;
  h = Math.imul(h ^ (h >>> 13), 1274126177);
  return ((h ^ (h >>> 16)) >>> 0) / 4294967296;
}

/** Generated terrain in [0, 1]: broad landforms plus field-scale texture. Not imagery. */
function terrain(x: number, y: number): number {
  const broad =
    0.5 +
    0.22 * Math.sin(x * 0.0071 + y * 0.0029 + 1.3) +
    0.17 * Math.sin(y * 0.0083 - x * 0.0046 + 2.6) +
    0.09 * Math.sin((x + y) * 0.019 + 0.4);
  return Math.min(1, Math.max(0, broad + 0.16 * (hash2(Math.floor(x / 9), Math.floor(y / 9)) - 0.5)));
}

const WATER: Rgb = [38, 52, 72];
const SHALLOW: Rgb = [86, 106, 132];
const GROUND: Rgb = [92, 88, 78];
const DRY: Rgb = [138, 128, 108];
const mixRgb = (a: Rgb, b: Rgb, t: number): Rgb => [lerp(a[0], b[0], t), lerp(a[1], b[1], t), lerp(a[2], b[2], t)];

/** Terrain value to a muted false-colour palette: water, bare ground, vegetation. */
function shade(v: number): Rgb {
  if (v < 0.36) return mixRgb(WATER, SHALLOW, v / 0.36);
  if (v < 0.62) return mixRgb(GROUND, DRY, (v - 0.36) / 0.26);
  return mixRgb(mixRgb(DRY, CHLOROPHYLL, 0.55), CHLOROPHYLL, Math.min(1, (v - 0.62) / 0.3));
}

interface Scene {
  ctx: CanvasRenderingContext2D;
  width: number;
  height: number;
  tile: number;
  columns: number;
  rows: number;
  /** One low-resolution image per level; drawn scaled up with smoothing off, so cells stay crisp. */
  levels: HTMLCanvasElement[];
  /** The figure's box in canvas coordinates. */
  figure: { left: number; top: number; right: number; bottom: number };
  swathWidth: number;
  /** Where the ground track crosses the canvas's vertical middle. */
  trackY: number;
}

/** The swath's centre line at height y, for a given progress. */
function swathX(scene: Scene, p: number, y: number): number {
  const t = clamp01((p - SWEEP.from) / (SWEEP.to - SWEEP.from));
  const travel = scene.width + scene.swathWidth * 2 + Math.abs(LEAN) * scene.height;
  const centre = -scene.swathWidth - (LEAN * scene.height) / 2 + t * travel;
  return centre + (y - scene.height / 2) * -LEAN;
}

/** Progress at which the swath's trailing edge passes the point (x, y). */
function passedAt(scene: Scene, x: number, y: number): number {
  const travel = scene.width + scene.swathWidth * 2 + Math.abs(LEAN) * scene.height;
  // Solve swathX(p, y) − swathWidth / 2 = x for p.
  const centre = x + scene.swathWidth / 2 - (y - scene.height / 2) * -LEAN;
  const t = (centre + scene.swathWidth + (LEAN * scene.height) / 2) / travel;
  return SWEEP.from + t * (SWEEP.to - SWEEP.from);
}

function buildLevels(width: number, height: number, tile: number): HTMLCanvasElement[] {
  return LEVELS.map((divisor) => {
    const cell = tile / divisor;
    const w = Math.ceil(width / cell);
    const h = Math.ceil(height / cell);
    const canvas = document.createElement("canvas");
    canvas.width = w;
    canvas.height = h;
    const ctx = canvas.getContext("2d");
    if (!ctx) return canvas;
    const image = ctx.createImageData(w, h);
    for (let y = 0; y < h; y++)
      for (let x = 0; x < w; x++) {
        const [r, g, b] = shade(terrain((x + 0.5) * cell, (y + 0.5) * cell));
        const i = (y * w + x) * 4;
        image.data[i] = r;
        image.data[i + 1] = g;
        image.data[i + 2] = b;
        image.data[i + 3] = 255;
      }
    ctx.putImageData(image, 0, 0);
    return canvas;
  });
}

function draw(scene: Scene, p: number, plate: HTMLElement | null) {
  const { ctx, width, height, tile, columns, rows, levels, figure } = scene;
  ctx.clearRect(0, 0, width, height);
  ctx.imageSmoothingEnabled = false;

  // The mosaic: each tile appears coarse as the swath leaves it, resolves, then clears.
  ctx.lineWidth = 1;
  for (let row = 0; row < rows; row++) {
    const y = row * tile;
    for (let column = 0; column < columns; column++) {
      const x = column * tile;
      const local = (p - passedAt(scene, x + tile / 2, y + tile / 2)) / RESOLVE;
      if (local <= 0 || local >= 1.15) continue;
      const over =
        x + tile > figure.left && x < figure.right && y + tile > figure.top && y < figure.bottom;
      const peak = over ? 0.72 : 0.16;
      const alpha = peak * smoothstep(0, 0.1, local) * (1 - smoothstep(0.62, 1.12, local));
      if (alpha < 0.01) continue;
      const level = Math.min(LEVELS.length - 1, Math.floor(local * LEVELS.length));
      const source = levels[level];
      const cell = tile / LEVELS[level];
      ctx.globalAlpha = alpha;
      ctx.drawImage(source, x / cell, y / cell, LEVELS[level], LEVELS[level], x, y, tile, tile);
      // The seam of a tile still being read.
      ctx.globalAlpha = 1;
      ctx.strokeStyle = rgba(TRACK, alpha * 0.35 * (1 - local));
      ctx.strokeRect(x + 0.5, y + 0.5, tile - 1, tile - 1);
    }
  }
  ctx.globalAlpha = 1;

  const presence = smoothstep(SWEEP.from - 0.02, SWEEP.from + 0.04, p) * (1 - smoothstep(SWEEP.to - 0.04, SWEEP.to + 0.02, p));
  const half = scene.swathWidth / 2;
  const topX = swathX(scene, p, 0);
  const bottomX = swathX(scene, p, height);

  if (presence > 0.005) {
    // The swath: a pale band with its scan rows, the leading edge brighter than the trailing.
    const band = ctx.createLinearGradient(topX - half, 0, topX + half, 0);
    band.addColorStop(0, rgba(TRACK, 0));
    band.addColorStop(0.7, rgba(TRACK, 0.07 * presence));
    band.addColorStop(1, rgba(TRACK, 0.16 * presence));
    ctx.fillStyle = band;
    ctx.beginPath();
    ctx.moveTo(topX - half, 0);
    ctx.lineTo(topX + half, 0);
    ctx.lineTo(bottomX + half, height);
    ctx.lineTo(bottomX - half, height);
    ctx.closePath();
    ctx.fill();

    ctx.strokeStyle = rgba(TRACK, 0.07 * presence);
    ctx.beginPath();
    for (let y = 2; y < height; y += 6) {
      const cx = swathX(scene, p, y);
      ctx.moveTo(cx - half, y);
      ctx.lineTo(cx + half, y);
    }
    ctx.stroke();

    ctx.lineWidth = 1;
    ctx.strokeStyle = rgba(TRACK, 0.75 * presence);
    ctx.beginPath();
    ctx.moveTo(topX + half, 0);
    ctx.lineTo(bottomX + half, height);
    ctx.stroke();
    ctx.strokeStyle = rgba(TRACK, 0.28 * presence);
    ctx.beginPath();
    ctx.moveTo(topX - half, 0);
    ctx.lineTo(bottomX - half, height);
    ctx.stroke();
  }

  // The ground track: flown where it is solid, ahead where it is dashed; it stays, faint, once
  // the pass is over.
  const trackAt = (x: number) => scene.trackY + (x - width / 2) * LEAN;
  const satX = swathX(scene, p, scene.trackY);
  const settle = 1 - smoothstep(SWEEP.to, 0.96, p);
  const fade = smoothstep(SWEEP.from - 0.03, SWEEP.from + 0.03, p);
  ctx.lineWidth = 1;
  ctx.setLineDash([]);
  ctx.strokeStyle = rgba(TRACK, 0.5 * settle * fade);
  ctx.beginPath();
  ctx.moveTo(0, trackAt(0));
  const flown = Math.max(0, Math.min(width, satX));
  ctx.lineTo(flown, trackAt(flown));
  ctx.stroke();
  if (satX < width) {
    ctx.setLineDash([3, 6]);
    ctx.strokeStyle = rgba(TRACK, 0.22 * fade);
    ctx.beginPath();
    ctx.moveTo(flown, trackAt(flown));
    ctx.lineTo(width, trackAt(width));
    ctx.stroke();
    ctx.setLineDash([]);
  }
  if (presence > 0.005 && satX > -10 && satX < width + 10) {
    const y = trackAt(satX);
    ctx.fillStyle = rgba(TRACK, presence);
    ctx.beginPath();
    ctx.moveTo(satX, y - 5);
    ctx.lineTo(satX + 5, y);
    ctx.lineTo(satX, y + 5);
    ctx.lineTo(satX - 5, y);
    ctx.closePath();
    ctx.fill();
    ctx.strokeStyle = rgba(TRACK, 0.35 * presence);
    ctx.beginPath();
    ctx.arc(satX, y, 11, 0, Math.PI * 2);
    ctx.stroke();
  }

  // The figure is uncovered behind the trailing edge, on the same lean.
  if (plate) {
    const leftTop = swathX(scene, p, figure.top) - half - figure.left;
    const leftBottom = swathX(scene, p, figure.bottom) - half - figure.left;
    const w = figure.right - figure.left;
    if (Math.min(leftTop, leftBottom) >= w + 2) plate.style.clipPath = "";
    else {
      const a = Math.max(-2, leftTop);
      const b = Math.max(-2, leftBottom);
      plate.style.clipPath = `polygon(-24px -24px, ${a.toFixed(1)}px -24px, ${b.toFixed(1)}px calc(100% + 24px), -24px calc(100% + 24px))`;
    }
  }
}

export function SatPass() {
  const canvasRef = useRef<HTMLCanvasElement>(null);

  useEffect(() => {
    const canvas = canvasRef.current;
    const host = canvas?.parentElement;
    const ctx = canvas?.getContext("2d");
    if (!canvas || !host || !ctx) return;
    const plate = host.querySelector<HTMLElement>(".fig-plate");

    let scene: Scene | null = null;

    const measure = (): boolean => {
      bleed(canvas, host);
      const { width, height } = fitCanvas(canvas, ctx, isPhone() ? 1 : 1.5);
      if (width === 0 || height === 0) return false;
      const box = canvas.getBoundingClientRect();
      const target = (plate ?? host).getBoundingClientRect();
      const tile = isPhone() ? 32 : 48;
      scene = {
        ctx,
        width,
        height,
        tile,
        columns: Math.ceil(width / tile),
        rows: Math.ceil(height / tile),
        levels: buildLevels(width, height, tile),
        figure: {
          left: target.left - box.left,
          top: target.top - box.top,
          right: target.right - box.left,
          bottom: target.bottom - box.top,
        },
        swathWidth: Math.min(240, Math.max(110, width * 0.13)),
        trackY: height * 0.56,
      };
      return true;
    };

    const progress = () => {
      const top = host.getBoundingClientRect().top;
      const vh = window.innerHeight;
      // Measured from the figure's top, so a tall (phone) figure is not left blank while its
      // middle is still below the fold: the pass begins as the figure arrives and is read by
      // the time its top is a quarter of the way down the screen.
      return clamp01((0.96 * vh - top) / (0.7 * vh));
    };

    const stop = scrub(host, {
      measure,
      progress,
      draw: (p, still) => {
        if (!scene) return;
        if (still) {
          scene.ctx.clearRect(0, 0, scene.width, scene.height);
          if (plate) plate.style.clipPath = "";
          return;
        }
        draw(scene, p, plate);
      },
    });
    return () => {
      stop();
      if (plate) plate.style.clipPath = "";
    };
  }, []);

  return <canvas ref={canvasRef} className="sig-layer sig-sat" aria-hidden="true" />;
}
