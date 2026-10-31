"use client";

import { useEffect, useRef } from "react";
import { clamp01, smoothstep } from "@/lib/motion";
import { illustrativeSeries } from "@/lib/quant";
import { PROGRAMME_PALETTE } from "../theme";
import { fitCanvas, isPhone, parseRgb, rgba, scrub, type Rgb } from "./scrub";

/**
 * ARGUS's signature: the tape. Across the full width of the section, the market series is
 * drawn in day by day as the page moves — the asset, its benchmark and a 20-day average —
 * with a price tag riding the head of the line and a ticker of daily closes running beneath
 * it. It is the same generated series the programme's figure measures, labelled as such.
 *
 * Scroll-scrubbed and reversible; under reduced motion it is drawn complete.
 */

const SERIES = parseRgb(PROGRAMME_PALETTE.market.primary);
const BENCHMARK = parseRgb(PROGRAMME_PALETTE.market.secondary);
const IVORY: Rgb = [239, 235, 228];
/** Warm steel, for falling days and day numbers. */
const MUTED: Rgb = [150, 146, 140];

const { asset, benchmark } = illustrativeSeries();
const DAYS = asset.length - 1;
const AVERAGE = (() => {
  let sum = 0;
  return asset.map((value, index) => {
    sum += value - (index >= 20 ? asset[index - 20] : 0);
    return sum / Math.min(index + 1, 20);
  });
})();
const LOW = Math.min(...asset, ...benchmark);
const HIGH = Math.max(...asset, ...benchmark);

/** Progress over which the series is drawn from its first day to its last. */
const DRAW = { from: 0.05, to: 0.9 } as const;

interface Scene {
  ctx: CanvasRenderingContext2D;
  width: number;
  height: number;
  left: number;
  right: number;
  top: number;
  bottom: number;
  font: string;
  muted: Rgb;
  phone: boolean;
  /** Ticker layout, measured in the mono face: where price and change sit in an item, and item pitch. */
  ticker: { price: number; change: number; pitch: number };
}

const xOf = (s: Scene, day: number) => s.left + (day / DAYS) * (s.right - s.left);
const yOf = (s: Scene, value: number) => s.bottom - ((value - LOW) / (HIGH - LOW)) * (s.bottom - s.top);

function valueAt(series: number[], day: number): number {
  const i = Math.min(DAYS - 1, Math.floor(day));
  return series[i] + (series[i + 1] - series[i]) * (day - i);
}

function stroke(s: Scene, series: number[], head: number, ink: string, width: number) {
  const { ctx } = s;
  ctx.strokeStyle = ink;
  ctx.lineWidth = width;
  ctx.beginPath();
  ctx.moveTo(xOf(s, 0), yOf(s, series[0]));
  const whole = Math.floor(head);
  for (let day = 1; day <= whole; day++) ctx.lineTo(xOf(s, day), yOf(s, series[day]));
  if (head > whole) ctx.lineTo(xOf(s, head), yOf(s, valueAt(series, head)));
  ctx.stroke();
}

function roundedRect(ctx: CanvasRenderingContext2D, x: number, y: number, w: number, h: number, r: number) {
  ctx.beginPath();
  ctx.moveTo(x + r, y);
  ctx.arcTo(x + w, y, x + w, y + h, r);
  ctx.arcTo(x + w, y + h, x, y + h, r);
  ctx.arcTo(x, y + h, x, y, r);
  ctx.arcTo(x, y, x + w, y, r);
  ctx.closePath();
}

function draw(s: Scene, p: number) {
  const { ctx, width, height } = s;
  ctx.clearRect(0, 0, width, height);
  const head = Math.max(0.001, clamp01((p - DRAW.from) / (DRAW.to - DRAW.from)) * DAYS);
  const shown = smoothstep(0, DRAW.from + 0.03, p);

  // The chart's rules, and a tick at the start of every trading month.
  ctx.lineWidth = 1;
  ctx.strokeStyle = rgba(IVORY, 0.06 * shown);
  ctx.beginPath();
  for (let k = 0; k <= 3; k++) {
    const y = Math.round(s.top + ((s.bottom - s.top) * k) / 3) + 0.5;
    ctx.moveTo(0, y);
    ctx.lineTo(width, y);
  }
  for (let day = 0; day <= DAYS; day += 21) {
    const x = Math.round(xOf(s, day)) + 0.5;
    ctx.moveTo(x, s.bottom + 4);
    ctx.lineTo(x, s.bottom + 9);
  }
  ctx.stroke();

  ctx.lineJoin = "round";
  ctx.lineCap = "round";
  stroke(s, benchmark, head, rgba(BENCHMARK, 0.55 * shown), 1);
  stroke(s, AVERAGE, head, rgba(SERIES, 0.35 * shown), 1);
  stroke(s, asset, head, rgba(SERIES, shown), s.phone ? 1.4 : 1.7);

  // The head: a cursor, the point, and a price tag riding at the right edge.
  const hx = xOf(s, head);
  const value = valueAt(asset, head);
  const hy = yOf(s, value);
  ctx.strokeStyle = rgba(IVORY, 0.1 * shown);
  ctx.beginPath();
  ctx.moveTo(Math.round(hx) + 0.5, s.top - 6);
  ctx.lineTo(Math.round(hx) + 0.5, s.bottom + 4);
  ctx.stroke();

  const tagW = s.phone ? 54 : 62;
  const tagX = s.right + 10;
  const tagFits = tagX + tagW <= width - 4;
  ctx.setLineDash([2, 4]);
  ctx.strokeStyle = rgba(SERIES, 0.35 * shown);
  ctx.beginPath();
  ctx.moveTo(hx + 6, hy);
  ctx.lineTo(tagFits ? tagX : width, hy);
  ctx.stroke();
  ctx.setLineDash([]);

  ctx.fillStyle = rgba(SERIES, shown);
  ctx.beginPath();
  ctx.arc(hx, hy, 3, 0, Math.PI * 2);
  ctx.fill();
  ctx.strokeStyle = rgba(SERIES, 0.3 * shown);
  ctx.beginPath();
  ctx.arc(hx, hy, 8, 0, Math.PI * 2);
  ctx.stroke();

  ctx.font = `500 ${s.phone ? 10 : 11}px ${s.font}`;
  ctx.textBaseline = "middle";
  if (tagFits) {
    roundedRect(ctx, tagX, hy - 10, tagW, 20, 6);
    ctx.fillStyle = rgba([18, 17, 18], 0.92 * shown);
    ctx.fill();
    ctx.strokeStyle = rgba(SERIES, 0.6 * shown);
    ctx.stroke();
    ctx.fillStyle = rgba(SERIES, shown);
    ctx.textAlign = "center";
    ctx.fillText(value.toFixed(2), tagX + tagW / 2, hy + 0.5);
  }

  // The ticker: daily closes running beneath the line, newest at the head, older fading out.
  const spacing = s.ticker.pitch;
  const tickerY = height - 12;
  const latest = Math.floor(head);
  const fraction = head - latest;
  ctx.textAlign = "left";
  for (let k = 0; ; k++) {
    const day = latest - k;
    if (day < 1) break;
    const x = hx - (k + fraction) * spacing - spacing * 0.5;
    if (x < -spacing) break;
    const change = asset[day] / asset[day - 1] - 1;
    const fade = shown * Math.max(0, 1 - k / 9) * (k === 0 ? 1 : 0.75);
    if (fade < 0.02) continue;
    const up = change >= 0;
    ctx.fillStyle = rgba(s.muted, fade);
    ctx.fillText(`D${day}`, x, tickerY);
    ctx.fillStyle = rgba(IVORY, 0.85 * fade);
    ctx.fillText(asset[day].toFixed(2), x + s.ticker.price, tickerY);
    ctx.fillStyle = rgba(up ? SERIES : s.muted, fade);
    ctx.fillText(`${up ? "+" : "−"}${Math.abs(change * 100).toFixed(2)}%`, x + s.ticker.change, tickerY);
  }
}

export function MarketTape() {
  const rootRef = useRef<HTMLDivElement>(null);
  const canvasRef = useRef<HTMLCanvasElement>(null);

  useEffect(() => {
    const root = rootRef.current;
    const canvas = canvasRef.current;
    const ctx = canvas?.getContext("2d");
    if (!root || !canvas || !ctx) return;

    let scene: Scene | null = null;
    const style = getComputedStyle(root);
    const measure = (): boolean => {
      const { width, height } = fitCanvas(canvas, ctx, isPhone() ? 1.5 : 2);
      if (width === 0 || height === 0) return false;
      const phone = width < 640;
      // The line spans the page's measure; the tag sits in the margin to its right.
      const gutter = Math.max(16, (width - Math.min(width, 1440)) / 2 + (phone ? 16 : 40));
      const font = style.fontFamily;
      ctx.font = `500 ${phone ? 10 : 11}px ${font}`;
      const gap = phone ? 6 : 8;
      const day = ctx.measureText("D252").width;
      const price = ctx.measureText("000.00").width;
      const change = ctx.measureText("+0.00%").width;
      scene = {
        ticker: { price: day + gap, change: day + price + gap * 2, pitch: day + price + change + gap * 2 + (phone ? 22 : 34) },
        ctx,
        width,
        height,
        left: gutter,
        right: width - gutter - (phone ? 62 : 84),
        top: 18,
        bottom: height - 36,
        font,
        muted: MUTED,
        phone,
      };
      return true;
    };

    const progress = () => {
      const rect = root.getBoundingClientRect();
      const vh = window.innerHeight;
      return clamp01((0.98 * vh - (rect.top + rect.height / 2)) / (0.62 * vh));
    };

    return scrub(
      root,
      { measure, progress, draw: (p) => scene && draw(scene, p) },
      { restingProgress: 1 },
    );
  }, []);

  return (
    <div ref={rootRef} className="sig-tape label" aria-hidden="true">
      <canvas ref={canvasRef} className="sig-tape-canvas" />
      <div className="shell sig-tape-caption text-faint">
        <span>Illustrative series — generated, not market data</span>
        <span className="max-sm:hidden">The series Fig. 06 measures</span>
      </div>
    </div>
  );
}
