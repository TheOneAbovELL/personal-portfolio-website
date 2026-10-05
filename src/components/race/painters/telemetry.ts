import { lengthAtY, type RaceLine } from "../line";
import { INK, type Frame } from "./frame";
import { strokeAlong } from "./racingLine";

/**
 * Telemetry sweep (RACE-SYSTEM §8): while the interface reports activity — Ask Omjee
 * retrieving — pulses of light run down the visible racing line. Pulses sit at fixed
 * intervals of arc length and move at constant speed, so scrolling during a sweep never
 * makes one jump. In signal yellow: this is the interface working, not the zone's light.
 */

/** Pulse speed and spacing, in viewport heights (per second, and between pulses). */
const SPEED = 1.1;
const SPACING = 1.6;
const TRAIL = 0.34;

export function paintTelemetry(frame: Frame, line: RaceLine): void {
  if (frame.still || frame.activity <= 0.004) return;
  const { ctx, height, scrollY } = frame;
  const spacing = height * SPACING;
  const trail = height * TRAIL;
  const from = lengthAtY(line, scrollY);
  const to = lengthAtY(line, scrollY + height) + trail;
  const phase = (frame.time * SPEED * height) % spacing;

  ctx.save();
  ctx.translate(0, -scrollY);
  ctx.strokeStyle = INK.yellow;
  ctx.lineWidth = 1.5;
  for (let head = Math.floor(from / spacing) * spacing + phase; head - trail < to; head += spacing) {
    if (head < from) continue;
    strokeAlong(frame, line, head - trail, head, (s) => {
      const k = 1 - (head - s) / trail;
      return k > 0 ? 0.75 * frame.activity * k * k : 0;
    });
  }
  ctx.restore();
}
