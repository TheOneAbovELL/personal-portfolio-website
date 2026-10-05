import { clamp, clamp01 } from "@/lib/motion";
import type { RaceLayout } from "./layout";
import { READING_LINE } from "./position";

/**
 * Development-only stills, so the environment can be screenshot-tested. The controller only
 * reads this outside production builds.
 *
 *   ?race=0.42          hold the page at 42% of its scroll range
 *   ?race=ask           put the top of a zone — its sector boundary — on the reading line
 *   ?race=ask:0.5       put the reading line halfway through a zone
 *   &raceEnergy=0.8     draw as if scrolling hard (0 → 1)
 *   &raceActivity=1     draw the telemetry sweep (0 → 1)
 *   &raceTime=0.4       the moment of the sweep to draw, in seconds
 *
 * A headless browser cannot capture a scrolled page, so the still does not scroll: it pulls
 * <main> up by the target offset (a negative margin) and the controller adds that offset to
 * every scroll position it reads. Fixed layers stay put and everything measured from element
 * rectangles behaves exactly as if the window had scrolled. The first real input removes the
 * margin, scrolls the window to the same place and hands the page back.
 */
export interface DevStill {
  /** How far the page is currently pulled up, in pixels: the virtual scroll position. */
  readonly offset: number;
  /** Re-aims the still for a fresh measurement of the page. */
  aim(layout: RaceLayout): void;
  /** Ends the still, leaving the window really scrolled to where it was held. */
  release(): void;
  energy: number;
  activity: number;
  time: number;
}

export function readDevStill(): DevStill | null {
  const params = new URLSearchParams(window.location.search);
  const target = params.get("race");
  const main = document.querySelector<HTMLElement>("main");
  if (target === null || !main) return null;

  const [name, at = "0"] = target.split(":");
  const amount = (key: string) => clamp01(Number(params.get(key)) || 0);
  let offset = 0;

  return {
    get offset() {
      return offset;
    },
    aim(layout) {
      const maxScroll = Math.max(0, layout.pageHeight - layout.height);
      const zone = layout.zones.find((candidate) => candidate.id === name);
      const next = zone
        ? clamp(zone.top + (zone.bottom - zone.top) * clamp01(Number(at) || 0) - layout.height * READING_LINE, 0, maxScroll)
        : clamp01(Number(name) || 0) * maxScroll;
      if (Math.abs(next - offset) < 0.5) return;
      offset = next;
      main.style.marginTop = `${-offset}px`;
    },
    release() {
      main.style.marginTop = "";
      window.scrollTo({ top: offset, behavior: "instant" });
      offset = 0;
    },
    energy: amount("raceEnergy"),
    activity: amount("raceActivity"),
    time: Number(params.get("raceTime")) || 0,
  };
}
