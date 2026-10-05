/**
 * Race environment state — the single source of truth for everything that reacts to where the
 * visitor is on the lap of the page.
 *
 * The environment controller (components/race/controller.ts) writes this state from one
 * requestAnimationFrame loop; anything else on the page reads it through `subscribe` or
 * `getState`, or nudges it through the semantic setters below. Components never animate the
 * background themselves — they say what is happening ("a query is in flight") and the
 * environment decides how that looks.
 *
 * This module is framework-free and safe to import from server components (it does nothing
 * until a client calls into it).
 */

/** A homepage sector (see `site.sections`), or the hero before the first one. */
export type ZoneId = "hero" | "about" | "capabilities" | "ask" | "work" | "experience" | "garage" | "contact";

export interface RaceState {
  /** The zone under the reading line. */
  zone: ZoneId;
  /** Index of that zone among the numbered sectors: -1 in the hero, 0 for the first sector. */
  sectorIndex: number;
  /** 0 → 1 progress through the current zone. */
  zoneProgress: number;
  /** 0 → 1 progress through the whole page. */
  pageProgress: number;
  /** Per-sector progress, 0 → 1 each, in `site.sections` order. Drives the sector bar. */
  sectors: number[];
  /** Smoothed scroll velocity in viewport-heights per second; sign is direction. */
  velocity: number;
  /** 0 → 1 "race intensity": rises with speed, decays with inertia. */
  energy: number;
  /** 0 → 1 proximity to the nearest sector boundary; drives grid formation. */
  boundary: number;
  /** 0 → 1 activity requested by the interface (e.g. a query in flight). */
  activity: number;
  reducedMotion: boolean;
}

export const initialRaceState: RaceState = {
  zone: "hero",
  sectorIndex: -1,
  zoneProgress: 0,
  pageProgress: 0,
  sectors: [],
  velocity: 0,
  energy: 0,
  boundary: 0,
  activity: 0,
  reducedMotion: false,
};

type Listener = (state: RaceState) => void;

let state: RaceState = initialRaceState;
const listeners = new Set<Listener>();
let activityTarget = 0;

export const race = {
  getState: (): RaceState => state,

  /** Called by the controller once per frame while anything is changing. */
  setState(next: RaceState): void {
    state = next;
    listeners.forEach((listener) => listener(state));
  },

  /** Subscribe to state changes; returns an unsubscribe function. */
  subscribe(listener: Listener): () => void {
    listeners.add(listener);
    return () => listeners.delete(listener);
  },

  /**
   * Ask the environment to show activity (0 → 1), e.g. while Ask Omjee is retrieving.
   * The controller eases toward this target; set it back to 0 when the work is done.
   */
  setActivity(level: number): void {
    activityTarget = Math.min(1, Math.max(0, level));
    wake?.();
  },

  getActivityTarget: (): number => activityTarget,

  /** The controller registers a function that restarts its loop when something external changes. */
  onWake(fn: (() => void) | null): void {
    wake = fn;
  },
};

let wake: (() => void) | null = null;
