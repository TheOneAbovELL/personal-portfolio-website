import type { CSSProperties } from "react";

/**
 * The motion grammar (see globals.css → "Motion grammar"):
 *   rise    body copy — soft, decelerating
 *   mask    large type — clipped from below
 *   snap    small instrumentation — fast and mechanical
 *   trace   lines — drawn left to right
 *   settle  figures and panels — settle with inertia
 */
export type RevealKind = "rise" | "mask" | "snap" | "trace" | "settle";

/**
 * Props that opt an element into scroll reveals (driven by components/motion/RevealObserver).
 * `index` staggers siblings. Spread onto any element: <p {...reveal("rise", 1)} />
 */
export const reveal = (kind: RevealKind = "rise", index = 0) => ({
  "data-reveal": kind,
  style: { "--reveal-index": index } as CSSProperties,
});
