import { site } from "@/content/site";
import { clamp01, smoothstep } from "@/lib/motion";
import type { RaceLayout, ZoneRect } from "./layout";
import type { ZoneId } from "./store";

/**
 * Position on the lap: which zone is under the reading line, how far through it, and how close
 * the nearest sector boundary is. Pure functions of the measured layout and a scroll offset.
 */

/** The reading line sits at half the viewport height. */
export const READING_LINE = 0.5;

/** A sector boundary is felt within this many viewport heights of the reading line. */
export const BOUNDARY_REACH = 0.5;

const SECTOR_IDS: readonly string[] = site.sections.map((section) => section.id);

/**
 * Page-space position of the reading line. It holds at mid-viewport, except over the last
 * half-viewport of scroll, where it slides down to the end of the last zone — otherwise the
 * final sector could never be completed, because the page stops scrolling first.
 */
export function readingY(layout: RaceLayout, scrollY: number): number {
  const { height, pageHeight, zones } = layout;
  const base = scrollY + height * READING_LINE;
  if (zones.length === 0) return base;

  const maxScroll = Math.max(0, pageHeight - height);
  const end = Math.min(zones[zones.length - 1].bottom, maxScroll + height);
  const baseAtEnd = maxScroll + height * READING_LINE;
  if (end <= baseAtEnd) return base;
  return base + (end - baseAtEnd) * smoothstep(maxScroll - height * 0.5, maxScroll, scrollY);
}

export interface Location {
  zone: ZoneId;
  /** Index among the numbered sectors; -1 in the hero. */
  sectorIndex: number;
  zoneProgress: number;
  /** 0 → 1 linear proximity of the nearest sector boundary to the reading line. */
  boundary: number;
}

const NOWHERE: Location = { zone: "hero", sectorIndex: -1, zoneProgress: 0, boundary: 0 };

/**
 * Locates the reading line and fills `sectors` (one 0 → 1 value per numbered sector, in
 * `site.sections` order) in place, so the frame loop allocates nothing.
 */
export function locate(layout: RaceLayout, readY: number, sectors: number[]): Location {
  const { zones, height, pageHeight } = layout;
  sectors.length = SECTOR_IDS.length;
  if (zones.length === 0) {
    sectors.fill(0);
    return NOWHERE;
  }

  // Progress is measured over the part of a zone the reading line can actually reach.
  const firstRead = height * READING_LINE;
  const lastRead = readingY(layout, Math.max(0, pageHeight - height));
  const progress = (zone: ZoneRect) => {
    const top = Math.max(zone.top, firstRead);
    const bottom = Math.min(zone.bottom, lastRead);
    if (bottom - top < 1) return readY >= zone.top ? 1 : 0;
    return clamp01((readY - top) / (bottom - top));
  };

  let current = zones[0];
  let boundary = 0;
  for (let i = 1; i < zones.length; i++) {
    const zone = zones[i];
    if (zone.top <= readY) current = zone;
    boundary = Math.max(boundary, 1 - Math.abs(zone.top - readY) / (height * BOUNDARY_REACH));
  }

  const sectorIndex = SECTOR_IDS.indexOf(current.id);
  for (let i = 0; i < SECTOR_IDS.length; i++) {
    const zone = zones.find((candidate) => candidate.id === SECTOR_IDS[i]);
    // A sector missing from the page (e.g. an empty Garage) counts as passed once a later one starts.
    sectors[i] = zone ? progress(zone) : sectorIndex > i ? 1 : 0;
  }

  return { zone: current.id, sectorIndex, zoneProgress: progress(current), boundary };
}
