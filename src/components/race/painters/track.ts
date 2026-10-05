import { lowerBound, type RaceLine } from "../line";
import { INK, type Frame } from "./frame";

/**
 * Track edges: the corridor the racing line runs in, as two very faint lines on a deeper
 * layer. Depth is local — the layer is pinned to the page at the reading line and compressed
 * around it — so a corner's edges slide slightly against the line as it passes, and line up
 * with it exactly when it is being read.
 */
const DEPTH = 0.96;

export function paintTrack(frame: Frame, line: RaceLine): void {
  if (!line.edges) return;
  const { ctx, height, scrollY, readY } = frame;
  const depth = frame.still ? 1 : DEPTH;
  const pin = readY - scrollY;
  // The page range that lands on screen once compressed.
  const top = readY - pin / depth - 2;
  const bottom = readY + (height - pin) / depth + 2;

  ctx.setLineDash([]);
  ctx.lineWidth = 1;
  ctx.strokeStyle = INK.steel;
  ctx.globalAlpha = 0.085 + 0.035 * frame.energy;
  ctx.beginPath();
  for (const { xs, ys } of line.edges) {
    const first = Math.max(0, lowerBound(ys, top) - 1);
    const last = lowerBound(ys, bottom);
    ctx.moveTo(xs[first], pin + (ys[first] - readY) * depth);
    for (let i = first + 1; i <= last; i++) ctx.lineTo(xs[i], pin + (ys[i] - readY) * depth);
  }
  ctx.stroke();
}
