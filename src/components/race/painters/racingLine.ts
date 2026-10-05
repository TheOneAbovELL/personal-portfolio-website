import { smoothstep } from "@/lib/motion";
import { headLength, lengthAtY, lowerBound, type LineStyle, type RaceLine } from "../line";
import { INK, type Frame } from "./frame";

/**
 * The racing line itself (RACE-SYSTEM §6): a very faint resting stroke for the whole visible
 * path, then the stretch beside the reading line lit in the zone's accent. The lit stretch is
 * a soft gradient along the path — brightest at its head, gone within half a viewport — and
 * it travels with scroll. No blur, no glow: it is a line, never a neon tube.
 */

const SOLID: number[] = [];
const DASH: Partial<Record<LineStyle, number[]>> = {
  fragments: [18, 7, 5, 7, 11, 9],
};

const REST_ALPHA = 0.13;
/** With reduced motion there is no lit stretch, so the static line carries a little more. */
const STILL_ALPHA = 0.2;
const LIT_ALPHA = 0.62;
/** The lit stretch is stroked in pieces of about this length, each at its own alpha. */
const PIECE = 14;
/** Half-height of the window that smooths the head through corners, in viewport heights. */
const HEAD_WINDOW = 0.22;

/**
 * Strokes the line between two arc lengths in short pieces, each at `alphaAt(s)`. The caller
 * sets colour and width and has already translated the context into page space.
 */
export function strokeAlong(
  frame: Frame,
  line: RaceLine,
  from: number,
  to: number,
  alphaAt: (s: number) => number,
): void {
  const { ctx } = frame;
  const { xs, ys, ss, runs } = line;
  // Clip to what is on screen: a corner can put a long stretch of path outside the viewport.
  const firstSeen = Math.max(0, lowerBound(ys, frame.scrollY) - 1);
  const lastSeen = lowerBound(ys, frame.scrollY + frame.height);
  const first = Math.max(firstSeen, lowerBound(ss, from) - 1, 0);
  const last = Math.min(lastSeen, lowerBound(ss, to));

  for (const run of runs) {
    if (run.style === "hidden" || run.end < first || run.start > last) continue;
    ctx.setLineDash(DASH[run.style] ?? SOLID);
    const end = Math.min(run.end + 1, last);
    let i = Math.max(run.start, first);
    while (i < end) {
      const start = i;
      ctx.beginPath();
      ctx.moveTo(xs[i], ys[i]);
      do {
        i++;
        ctx.lineTo(xs[i], ys[i]);
      } while (i < end && ss[i] - ss[start] < PIECE);
      const alpha = alphaAt((ss[start] + ss[i]) / 2);
      if (alpha < 0.004) continue;
      ctx.globalAlpha = alpha;
      ctx.lineDashOffset = ss[start];
      ctx.stroke();
    }
  }
  ctx.setLineDash(SOLID);
  ctx.lineDashOffset = 0;
}

export function paintRacingLine(frame: Frame, line: RaceLine): void {
  const { ctx, height, scrollY } = frame;
  const { xs, ys, ss, runs, marks, finish } = line;
  const first = Math.max(0, lowerBound(ys, scrollY - 8) - 1);
  const last = lowerBound(ys, scrollY + height + 8);

  ctx.save();
  ctx.translate(0, -scrollY);
  ctx.lineWidth = 1;
  ctx.lineCap = "butt";
  ctx.lineJoin = "round";

  /* Resting stroke: the whole visible path, one stroke per style run. */
  ctx.strokeStyle = INK.steel;
  ctx.globalAlpha = frame.still ? STILL_ALPHA : REST_ALPHA;
  for (const run of runs) {
    if (run.style === "hidden" || run.end < first || run.start > last) continue;
    const from = Math.max(run.start, first);
    const to = Math.min(run.end + 1, last); // one point into the next run, so runs join
    ctx.setLineDash(DASH[run.style] ?? SOLID);
    ctx.lineDashOffset = ss[from];
    ctx.beginPath();
    ctx.moveTo(xs[from], ys[from]);
    for (let i = from + 1; i <= to; i++) ctx.lineTo(xs[i], ys[i]);
    ctx.stroke();
  }
  ctx.setLineDash(SOLID);
  ctx.lineDashOffset = 0;

  ctx.beginPath();
  for (const mark of marks) {
    if (mark.s < ss[first] || mark.s > ss[last]) continue;
    ctx.moveTo(mark.x0, mark.y0);
    ctx.lineTo(mark.x1, mark.y1);
  }
  ctx.stroke();

  /* Lit stretch. The side the scroll came from trails a little longer: a tail, with inertia. */
  const head = frame.still ? lengthAtY(line, frame.readY) : headLength(line, frame.readY, height * HEAD_WINDOW);
  const behind = height * (0.42 + 0.2 * Math.max(0, frame.drift));
  const ahead = height * (0.42 + 0.2 * Math.max(0, -frame.drift));
  const litAt = (s: number) => {
    const q = s < head ? (head - s) / behind : (s - head) / ahead;
    if (q >= 1) return 0;
    const k = 1 - q * q;
    return k * k;
  };

  if (!frame.still) {
    const peak = LIT_ALPHA + 0.2 * frame.energy;
    ctx.strokeStyle = frame.accent;
    ctx.lineWidth = 1.25 + 0.5 * frame.energy;
    strokeAlong(frame, line, head - behind, head + ahead, (s) => peak * litAt(s));

    ctx.lineWidth = 1;
    for (const mark of marks) {
      const lit = litAt(mark.s);
      if (lit <= 0) continue;
      ctx.globalAlpha = peak * lit;
      ctx.beginPath();
      ctx.moveTo(mark.x0, mark.y0);
      ctx.lineTo(mark.x1, mark.y1);
      ctx.stroke();
    }
  }

  /* The finish: a line across the track and a kerb mark, lighting as the head arrives. */
  if (finish && finish.y > scrollY - 16 && finish.y < scrollY + height + 16) {
    const arrival = frame.still ? 0.5 : 1 - smoothstep(0, height * 0.45, finish.s - head);
    const reach = line.halfTrack + 5;
    const y = Math.round(finish.y) + 0.5;
    const inward = finish.x < frame.width / 2 ? 1 : -1;
    ctx.lineWidth = 1;
    ctx.strokeStyle = INK.bone;
    ctx.globalAlpha = 0.16 + 0.44 * arrival;
    ctx.beginPath();
    ctx.moveTo(finish.x - reach, y);
    ctx.lineTo(finish.x + reach, y);
    ctx.stroke();

    ctx.globalAlpha = 0.2 + 0.6 * arrival;
    for (let block = 0; block < 4; block++) {
      ctx.fillStyle = block % 2 === 0 ? INK.red : INK.bone;
      const x = finish.x + inward * (reach + 6 + block * 5);
      ctx.fillRect(inward > 0 ? x : x - 5, y - 2, 5, 3);
    }
  }

  ctx.restore();
}
