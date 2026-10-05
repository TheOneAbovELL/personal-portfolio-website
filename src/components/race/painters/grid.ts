import { clamp01 } from "@/lib/motion";
import type { Boundary, RaceLine } from "../line";
import { INK, type Frame } from "./frame";

/**
 * Grid formation and sector pass (RACE-SYSTEM §7) — the transition at every sector boundary.
 *
 * Everything is a function of how close the boundary is to the reading line, so it plays
 * forwards and backwards with scroll and has no timers. Far away the starting grid is almost
 * invisible and its two files hang apart, either side of the track; as the boundary
 * approaches they slide together onto the track and come up, the sector marker lights as it
 * passes, and it all falls back behind. Scroll energy adds a little reach and brightness.
 */

/** The grid forms within this many viewport heights of the reading line. */
const FORM_REACH = 0.62;
/** The marker only starts to light once the boundary is this far into that range. */
const PASS_FROM = 0.45;
const SLOT_REST = 0.045;
const SLOT_LIT = 0.34;
const ARM = 104;
const KERB_BLOCK = 5;

const ease = (t: number) => t * t * (3 - 2 * t);

/** 0 → 1 as a boundary comes up to the reading line, or null when it is nowhere near the screen. */
function proximityOf(frame: Frame, boundary: Boundary): number | null {
  const distance = Math.abs(boundary.y - frame.readY);
  if (distance > frame.height * 1.1) return null;
  return clamp01(1 - distance / (frame.height * FORM_REACH));
}

function paintSlots(frame: Frame, line: RaceLine, boundary: Boundary, offset: number, form: number): void {
  const { ctx } = frame;
  const half = line.slotWidth / 2;
  const depth = line.slotDepth;
  const lit = SLOT_REST + (SLOT_LIT + 0.12 * frame.energy - SLOT_REST) * form;
  const stirring = !frame.still && frame.activity > 0.004;

  for (const slot of boundary.slots) {
    // Activity stirs the grid: each slot breathes and shifts along the track, out of step.
    const wave = stirring ? Math.sin(frame.time * 4 + slot.phase * 6.283) : 0;
    const along = wave * 1.5 * frame.activity;
    const x = slot.x + slot.ux * along;
    const y = slot.y + slot.uy * along + offset * (slot.depth - 1);
    // Across the track is the tangent turned a quarter; the bracket opens toward where it came from.
    const ax = slot.uy * half;
    const ay = -slot.ux * half;
    const bx = slot.ux * depth;
    const by = slot.uy * depth;

    ctx.globalAlpha = lit + (stirring ? 0.07 * frame.activity * (0.5 + 0.5 * wave) : 0);
    ctx.beginPath();
    ctx.moveTo(x + ax - bx, y + ay - by);
    ctx.lineTo(x + ax, y + ay);
    ctx.lineTo(x - ax, y - ay);
    ctx.lineTo(x - ax - bx, y - ay - by);
    ctx.stroke();
  }
}

/** Starting-grid slots. Drawn under the racing line. */
export function paintGrid(frame: Frame, line: RaceLine): void {
  const { ctx } = frame;
  ctx.save();
  ctx.translate(0, -frame.scrollY);
  ctx.setLineDash([]);
  ctx.strokeStyle = INK.bone;
  ctx.lineWidth = 1;

  for (const boundary of line.boundaries) {
    const proximity = proximityOf(frame, boundary);
    if (proximity === null) continue;
    if (frame.still) {
      // Reduced motion: the grid is simply there, aligned and quiet.
      paintSlots(frame, line, boundary, 0, 0.25);
      continue;
    }
    // Files hang apart in proportion to distance; speed stretches the gap and leans it back.
    const offset = (boundary.y - frame.readY) * (1 + 0.5 * frame.energy) - frame.drift * 60;
    paintSlots(frame, line, boundary, offset, ease(proximity));
  }
  ctx.restore();
}

function paintMarker(frame: Frame, boundary: Boundary, pass: number): void {
  const { ctx } = frame;
  const { ax, ay, bx, by, dir, label } = boundary.marker;
  const y = Math.round(ay) + 0.5;
  const arm = frame.compact ? ARM - 16 : ARM;

  // The timing line across the track.
  ctx.globalAlpha = 0.14 + 0.4 * pass;
  ctx.beginPath();
  ctx.moveTo(ax, ay);
  ctx.lineTo(bx, by);
  ctx.stroke();

  ctx.globalAlpha = 0.1 + 0.24 * pass;
  ctx.beginPath();
  ctx.moveTo(ax, y);
  ctx.lineTo(ax + dir * arm, y);
  ctx.stroke();

  ctx.globalAlpha = 0.22 + 0.6 * pass;
  ctx.fillStyle = INK.bone;
  ctx.textAlign = dir > 0 ? "left" : "right";
  ctx.fillText(label, ax + dir * 8, y - 7);

  // The kerb closes the hairline: four blocks, red first.
  ctx.globalAlpha = 0.16 + 0.68 * pass;
  for (let block = 0; block < 4; block++) {
    ctx.fillStyle = block % 2 === 0 ? INK.red : INK.bone;
    const x = ax + dir * (arm - (4 - block) * KERB_BLOCK);
    ctx.fillRect(dir > 0 ? x : x - KERB_BLOCK, y - 3.5, KERB_BLOCK, 3);
  }
}

/** Sector markers: "SECTOR 03", a hairline and a short kerb. Drawn over the racing line. */
export function paintMarkers(frame: Frame, line: RaceLine): void {
  const { ctx } = frame;
  ctx.save();
  ctx.translate(0, -frame.scrollY);
  ctx.setLineDash([]);
  ctx.strokeStyle = INK.bone;
  ctx.lineWidth = 1;
  ctx.font = `500 10px ${frame.mono}`;
  ctx.textBaseline = "alphabetic";
  if ("letterSpacing" in ctx) ctx.letterSpacing = "1.4px";

  for (const boundary of line.boundaries) {
    const proximity = proximityOf(frame, boundary);
    if (proximity === null) continue;
    const pass = frame.still ? 0.45 : ease(clamp01((proximity - PASS_FROM) / (1 - PASS_FROM)));
    paintMarker(frame, boundary, pass);
  }
  ctx.restore();
}
