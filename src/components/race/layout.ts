import { site } from "@/content/site";
import type { ZoneId } from "./store";

/**
 * Measurement. Everything the environment knows about the page's geometry is read here, in
 * one pass, when the layout changes (mount, resize, content growing) — never per frame.
 */

export type Rgb = readonly [number, number, number];

export interface ZoneRect {
  id: ZoneId;
  /** Page-space edges. */
  top: number;
  bottom: number;
  /** Empty space inside the zone's top and bottom edges (its shell padding). */
  padTop: number;
  padBottom: number;
  /** Paints its own opaque surface (the paper section); the environment is hidden behind it. */
  opaque: boolean;
}

/** An element that tints atmosphere light A while it spans the reading line. */
export interface LightRect {
  top: number;
  bottom: number;
  rgb: Rgb;
}

export interface RaceLayout {
  /** Viewport size in CSS pixels. */
  width: number;
  height: number;
  pageHeight: number;
  /** Touch-first device: the canvas renders at a device-pixel-ratio of 1. */
  coarse: boolean;
  /** Small or touch screens get the reduced environment (see RACE-SYSTEM §10). */
  compact: boolean;
  /** Horizontal edges of the content column (the shell minus its gutters). */
  contentLeft: number;
  contentRight: number;
  /** Zones in page order. Empty on routes that are not the homepage. */
  zones: ZoneRect[];
  lights: LightRect[];
}

const ZONE_IDS = new Set<string>(["hero", ...site.sections.map((section) => section.id)]);
const isZoneId = (value: string | undefined): value is ZoneId => value !== undefined && ZONE_IDS.has(value);

/** Below this width the layout is single-column and the gutters are too narrow for a track. */
const COMPACT_BELOW = 1024;

function parseRgb(value: string | undefined): Rgb | null {
  const parts = (value ?? "").trim().split(/[\s,]+/).map(Number);
  if (parts.length !== 3 || parts.some((part) => !Number.isFinite(part) || part < 0 || part > 255)) return null;
  return [parts[0], parts[1], parts[2]];
}

/**
 * `offset` is the distance the page is pulled up by a development still (0 otherwise); it is
 * added back so the result is always in true page coordinates.
 */
export function measureLayout(env: HTMLElement, offset: number): RaceLayout {
  const width = env.clientWidth;
  const height = env.clientHeight;
  const scrollY = window.scrollY + offset;

  // Fallback gutter mirrors --gutter in globals.css; the measured shell below replaces it.
  let contentLeft = Math.min(64, Math.max(20, width * 0.04));
  let contentRight = width - contentLeft;
  let measuredShell = false;

  const zones: ZoneRect[] = [];
  document.querySelectorAll<HTMLElement>("[data-race-zone]").forEach((element) => {
    const id = element.dataset.raceZone;
    if (!isZoneId(id)) return;
    const rect = element.getBoundingClientRect();
    if (rect.height <= 0) return;

    // Every zone lays its content out in a `.shell`; its padding is the zone's whitespace.
    const shell = element.querySelector<HTMLElement>(":scope > .shell");
    let padTop = 0;
    let padBottom = 0;
    if (shell) {
      const style = getComputedStyle(shell);
      padTop = parseFloat(style.paddingTop) || 0;
      padBottom = parseFloat(style.paddingBottom) || 0;
      if (!measuredShell) {
        const shellRect = shell.getBoundingClientRect();
        contentLeft = shellRect.left + (parseFloat(style.paddingLeft) || 0);
        contentRight = shellRect.right - (parseFloat(style.paddingRight) || 0);
        measuredShell = true;
      }
    }

    zones.push({
      id,
      top: rect.top + scrollY,
      bottom: rect.bottom + scrollY,
      padTop,
      padBottom,
      opaque: element.dataset.surface === "paper",
    });
  });
  zones.sort((a, b) => a.top - b.top);

  const lights: LightRect[] = [];
  document.querySelectorAll<HTMLElement>("[data-race-light]").forEach((element) => {
    const rgb = parseRgb(element.dataset.raceLight);
    if (!rgb) return;
    const rect = element.getBoundingClientRect();
    if (rect.height <= 0) return;
    lights.push({ top: rect.top + scrollY, bottom: rect.bottom + scrollY, rgb });
  });

  const coarse = window.matchMedia("(pointer: coarse)").matches;
  return {
    width,
    height,
    pageHeight: Math.max(document.documentElement.scrollHeight + offset, height),
    coarse,
    compact: coarse || width < COMPACT_BELOW,
    contentLeft,
    contentRight,
    zones,
    lights,
  };
}
