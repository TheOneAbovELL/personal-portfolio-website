import { site } from "@/content/site";
import { clamp, smoothstep } from "@/lib/motion";
import type { RaceLayout, ZoneRect } from "./layout";
import type { ZoneId } from "./store";

/**
 * The racing line: one deterministic path down the whole page, in page coordinates, built
 * from the measured zones (RACE-SYSTEM §6). It runs in the gutter beside each section and
 * crosses the page in the whitespace between sections — the corners of the lap.
 *
 * Everything drawn on the canvas hangs off this geometry: the track edges are its corridor,
 * the starting grid sits on it before each sector boundary, and the sector markers stand at
 * the boundaries. It is rebuilt when the layout is measured and never touched per frame.
 */

/** How a zone draws its stretch of the line (RACE-SYSTEM §5). */
export type LineStyle =
  | "plain"
  | "telemetry" // a sensor trace: a fine wobble whose amplitude breathes
  | "circuit" // a board trace: lateral steps with 45° chamfers
  | "ticks" // a query scale: evenly spaced tick marks
  | "signal" // packets of oscillation separated by silence
  | "hidden" // behind the paper section
  | "fragments" // irregular dashes
  | "finish"; // straight to the finish line

type Lane = "left" | "right" | "column";

/** Which side each zone's line runs on. Alternating sides is what puts a corner at every boundary. */
const LANES: Record<ZoneId, Lane> = {
  hero: "right",
  about: "column", // split sections leave their first three columns empty; the line takes them
  capabilities: "right",
  ask: "left",
  work: "right",
  experience: "right", // unseen — it stays on the side it went under the paper
  garage: "left",
  contact: "right",
};

const STYLES: Record<ZoneId, LineStyle> = {
  hero: "plain",
  about: "telemetry",
  capabilities: "circuit",
  ask: "ticks",
  work: "signal",
  experience: "hidden",
  garage: "fragments",
  contact: "finish",
};

/** Sampling interval per style, in page pixels: fine where the modulation is fine. */
const STEP: Record<LineStyle, number> = {
  plain: 16,
  telemetry: 3,
  circuit: 1.5,
  ticks: 16,
  signal: 1.5,
  hidden: 48,
  fragments: 16,
  finish: 16,
};

/** Centre of the empty three-of-twelve column in split sections, as a fraction of the content width. */
const COLUMN_AT = 0.113;
/** Modulation fades in and out over this distance at the ends of a straight. */
const FADE = 90;

const SECTOR_IDS: readonly string[] = site.sections.map((section) => section.id);

export interface Run {
  /** Inclusive point indices. */
  start: number;
  end: number;
  style: LineStyle;
}

/** A short stroke attached to the line: a scale tick or an apex tick. */
export interface Mark {
  x0: number;
  y0: number;
  x1: number;
  y1: number;
  /** Arc length of the point on the line it belongs to. */
  s: number;
}

/** One starting-grid slot: an open-backed bracket facing along the direction of travel. */
export interface Slot {
  x: number;
  y: number;
  /** Unit tangent of the line here (direction of travel). */
  ux: number;
  uy: number;
  /** Parallax depth: 1 moves with the page; the two files sit either side of it. */
  depth: number;
  /** Deterministic 0 → 1 offset, so slots do not stir in unison. */
  phase: number;
}

export interface SectorMarker {
  /** "SECTOR 03" — numbers a real section. */
  label: string;
  /** Timing line across the track, from (ax, ay) to (bx, by). */
  ax: number;
  ay: number;
  bx: number;
  by: number;
  /** The label's hairline leaves (ax, ay) horizontally in this direction. */
  dir: 1 | -1;
}

export interface Boundary {
  /** Page y of the sector boundary (the top of the zone it opens). */
  y: number;
  slots: Slot[];
  marker: SectorMarker;
}

export interface Polyline {
  xs: Float32Array;
  ys: Float32Array;
}

export interface RaceLine {
  /** The line as a polyline; `ys` never decreases, so it can be searched by page position. */
  xs: Float32Array;
  ys: Float32Array;
  /** Cumulative arc length at each point. */
  ss: Float32Array;
  /** Cumulative integral of arc length over page y — see `headLength`. */
  areas: Float64Array;
  runs: Run[];
  /** Sorted by arc length. */
  marks: Mark[];
  boundaries: Boundary[];
  /** The two track edges, or null where the layout has no room for a track. */
  edges: [Polyline, Polyline] | null;
  finish: { x: number; y: number; s: number } | null;
  /** Half the track width, and the slot bracket's size across and along the track. */
  halfTrack: number;
  slotWidth: number;
  slotDepth: number;
}

/** Deterministic 0 → 1 noise from an integer-ish seed. */
const hash = (n: number) => {
  const x = Math.sin(n * 127.1 + 311.7) * 43758.5453;
  return x - Math.floor(x);
};

/** Lateral offset of the line, in pixels, `u` pixels along a straight. */
function modulate(style: LineStyle, u: number): number {
  switch (style) {
    case "telemetry": {
      const swell = 0.5 + 0.5 * Math.sin(u / 150);
      return (1.5 + 4.5 * swell) * Math.sin(u / 9) + 1.5 * swell * Math.sin(u / 3.7 + 1.3);
    }
    case "circuit": {
      // Each segment sits on one of three parallel tracks; changes of track are 45° chamfers.
      const length = 96;
      const pitch = 9;
      const k = Math.floor(u / length);
      const level = (n: number) => (Math.floor(hash(n) * 3) - 1) * pitch;
      const from = level(k - 1);
      const to = level(k);
      const along = u - k * length;
      return Math.abs(to - from) > along ? from + Math.sign(to - from) * along : to;
    }
    case "signal": {
      const period = 360;
      const burst = 132;
      const k = Math.floor(u / period);
      const along = u - k * period - (period - burst) / 2;
      if (along < 0 || along > burst) return 0;
      const envelope = Math.sin((Math.PI * along) / burst) ** 2;
      return (4 + 5 * hash(k + 0.5)) * envelope * Math.sin(along / (1.6 + 0.9 * hash(k)));
    }
    default:
      return 0;
  }
}

interface Straight {
  cross: false;
  x: number;
  y0: number;
  y1: number;
  style: LineStyle;
}

/**
 * A corner pair, drawn the way a circuit map draws one: an arc out of the lane, a straight
 * across the page, an arc into the next lane. Constant-radius corners keep the track edges
 * (offsets of this path) clean, and the straight gives the starting grid somewhere to stand.
 */
interface Crossing {
  cross: true;
  xa: number;
  xb: number;
  y0: number;
  y1: number;
  radius: number;
  /** Angle each corner turns through, from straight down the page. */
  theta: number;
}

interface PathPoint {
  x: number;
  y: number;
  /** Unit tangent. */
  tx: number;
  ty: number;
}

/** Lays out a crossing between two lanes around `centre`, with its straight spanning `rise` vertically. */
function planCrossing(xa: number, xb: number, centre: number, radius: number, rise: number): Crossing {
  const run = Math.abs(xb - xa);
  // Solve for the corner angle at which the two arcs and the straight add up to the lane change.
  let lo = 0;
  let hi = Math.PI / 2 - 1e-4;
  for (let i = 0; i < 40; i++) {
    const mid = (lo + hi) / 2;
    if (2 * radius * (1 - Math.cos(mid)) + rise * Math.tan(mid) < run) lo = mid;
    else hi = mid;
  }
  const theta = (lo + hi) / 2;
  const half = radius * Math.sin(theta) + rise / 2;
  return { cross: true, xa, xb, y0: centre - half, y1: centre + half, radius, theta };
}

function traceCrossing(c: Crossing): { points: PathPoint[]; apexes: PathPoint[] } {
  const dir = Math.sign(c.xb - c.xa);
  const { radius, theta } = c;
  const entry = (phi: number): PathPoint => ({
    x: c.xa + dir * radius * (1 - Math.cos(phi)),
    y: c.y0 + radius * Math.sin(phi),
    tx: dir * Math.sin(phi),
    ty: Math.cos(phi),
  });
  const exit = (phi: number): PathPoint => ({
    x: c.xb - dir * radius * (1 - Math.cos(phi)),
    y: c.y1 - radius * Math.sin(phi),
    tx: dir * Math.sin(phi),
    ty: Math.cos(phi),
  });

  const points: PathPoint[] = [];
  const arcSteps = Math.max(6, Math.ceil((radius * theta) / 4));
  for (let i = 0; i <= arcSteps; i++) points.push(entry((theta * i) / arcSteps));

  const from = entry(theta);
  const to = exit(theta);
  const straightSteps = Math.max(1, Math.ceil(Math.hypot(to.x - from.x, to.y - from.y) / 16));
  for (let i = 1; i < straightSteps; i++) {
    const t = i / straightSteps;
    points.push({ x: from.x + (to.x - from.x) * t, y: from.y + (to.y - from.y) * t, tx: from.tx, ty: from.ty });
  }

  for (let i = 0; i <= arcSteps; i++) points.push(exit(theta * (1 - i / arcSteps)));
  return { points, apexes: [entry(theta / 2), exit(theta / 2)] };
}

/** The visible whitespace around the boundary between two zones: paper hides its own side. */
function seam(above: ZoneRect, below: ZoneRect) {
  const top = above.opaque ? below.top : below.top - above.padBottom;
  const bottom = below.opaque ? below.top : below.top + below.padTop;
  return { top, bottom, centre: (top + bottom) / 2 };
}

/** First index whose value is >= `value` in an ascending array (clamped to the last index). */
export function lowerBound(values: Float32Array, value: number): number {
  let lo = 0;
  let hi = values.length - 1;
  while (lo < hi) {
    const mid = (lo + hi) >> 1;
    if (values[mid] < value) lo = mid + 1;
    else hi = mid;
  }
  return lo;
}

/** Arc length of the line where it passes page position `y`. */
export function lengthAtY(line: Pick<RaceLine, "ys" | "ss">, y: number): number {
  const { ys, ss } = line;
  const i = lowerBound(ys, y);
  if (i === 0) return ss[0];
  const span = ys[i] - ys[i - 1];
  const t = span > 0 ? clamp((y - ys[i - 1]) / span, 0, 1) : 1;
  return ss[i - 1] + (ss[i] - ss[i - 1]) * t;
}

/** Integral of arc length over page y, from the top of the line to `y`. */
function areaAtY(line: Pick<RaceLine, "ys" | "ss" | "areas">, y: number): number {
  const { ys, ss, areas } = line;
  const last = ys.length - 1;
  if (y <= ys[0]) return (y - ys[0]) * ss[0];
  if (y >= ys[last]) return areas[last] + (y - ys[last]) * ss[last];
  const i = lowerBound(ys, y);
  return areas[i - 1] + ((y - ys[i - 1]) * (ss[i - 1] + lengthAtY(line, y))) / 2;
}

/**
 * Where the lit head of the line is when the reading line is at page position `y`: the arc
 * length averaged over a window around it. On a straight that is simply the point beside the
 * reading line. Through a corner, where the path covers a lot of ground in very little
 * scroll, the average spreads that sprint over the whole window, so the light sweeps across
 * the page instead of flashing across it.
 */
export function headLength(line: Pick<RaceLine, "ys" | "ss" | "areas">, y: number, window: number): number {
  if (window <= 0) return lengthAtY(line, y);
  return (areaAtY(line, y + window) - areaAtY(line, y - window)) / (2 * window);
}

/** Point and unit tangent of the line at arc length `s`. */
function pointAtLength(line: Pick<RaceLine, "xs" | "ys" | "ss">, s: number): PathPoint {
  const { xs, ys, ss } = line;
  const last = ss.length - 1;
  const i = Math.max(1, lowerBound(ss, s));
  const span = ss[i] - ss[i - 1];
  const t = span > 0 ? clamp((s - ss[i - 1]) / span, 0, 1) : 0;
  // The tangent is taken over a few points so one short segment cannot skew it.
  const a = Math.max(0, i - 3);
  const b = Math.min(last, i + 2);
  const length = Math.hypot(xs[b] - xs[a], ys[b] - ys[a]) || 1;
  return {
    x: xs[i - 1] + (xs[i] - xs[i - 1]) * t,
    y: ys[i - 1] + (ys[i] - ys[i - 1]) * t,
    tx: (xs[b] - xs[a]) / length,
    ty: (ys[b] - ys[a]) / length,
  };
}

/** Lanes are snapped to the pixel grid so the long vertical runs stay one crisp pixel wide. */
const snap = (x: number) => Math.round(x) + 0.5;

export function buildRaceLine(layout: RaceLayout): RaceLine | null {
  const { width, height, compact, contentLeft, contentRight, zones } = layout;
  if (width <= 0 || height <= 0) return null;

  const outerLeft = Math.min(contentLeft * 0.5, 64);
  const outerRight = Math.min((width - contentRight) * 0.5, 64);
  const laneX: Record<Lane, number> = {
    left: snap(contentLeft - outerLeft),
    right: snap(contentRight + outerRight),
    column: snap(contentLeft + (contentRight - contentLeft) * COLUMN_AT),
  };
  // Small screens: one line down the right edge, no corners (RACE-SYSTEM §10).
  const laneOf = (zone: ZoneRect) => (compact ? laneX.right : laneX[LANES[zone.id]]);
  const halfTrack = compact ? 8 : clamp(Math.min(outerLeft, outerRight) - 6, 14, 34);
  const amplitude = compact ? 0.5 : 1;

  /* ---- Pieces: straights down a lane, joined by crossings where the lane changes ---- */

  const pieces: (Straight | Crossing)[] = [];
  const lastZone: ZoneRect | undefined = zones[zones.length - 1];
  const finishY = lastZone && STYLES[lastZone.id] === "finish" ? lastZone.bottom - lastZone.padBottom * 0.5 : null;

  if (zones.length === 0) {
    // Not the homepage: a plain line keeps the environment continuous between routes.
    pieces.push({ cross: false, x: laneX.right, y0: 0, y1: layout.pageHeight, style: "plain" });
  }
  let cursor = zones.length > 0 ? zones[0].top : 0;
  for (let i = 0; i < zones.length; i++) {
    const zone = zones[i];
    const next: ZoneRect | undefined = zones[i + 1];
    const x = laneOf(zone);
    let end = next ? next.top : (finishY ?? zone.bottom);
    let crossing: Crossing | null = null;

    if (next && laneOf(next) !== x) {
      const gap = seam(zone, next);
      const shortest = Math.min(zone.bottom - zone.top, next.bottom - next.top);
      const run = Math.abs(laneOf(next) - x);
      // The straight stays inside the whitespace; the corners may reach past it, beside the content.
      const radius = Math.min(clamp(height * 0.14, 56, 130), shortest * 0.2, run * 0.2);
      const rise = Math.min(clamp((gap.bottom - gap.top) * 0.5, 48, 140), shortest * 0.3);
      crossing = planCrossing(x, laneOf(next), gap.centre, radius, rise);
      // Never start above the point the line has already reached (very short zones).
      const shift = Math.max(0, cursor + 1 - crossing.y0);
      crossing.y0 += shift;
      crossing.y1 += shift;
      end = crossing.y0;
    }

    if (end > cursor) pieces.push({ cross: false, x, y0: cursor, y1: end, style: STYLES[zone.id] });
    if (crossing) pieces.push(crossing);
    cursor = crossing ? crossing.y1 : Math.max(cursor, end);
  }

  /* ---- Sampling ---- */

  const zoneStyleAt = (y: number): LineStyle => {
    let style: LineStyle = "plain";
    for (const zone of zones) if (zone.top <= y) style = STYLES[zone.id];
    return style;
  };
  const isHidden = (y: number) => zones.some((zone) => zone.opaque && y > zone.top && y < zone.bottom);

  const px: number[] = [];
  const py: number[] = [];
  const pstyle: LineStyle[] = [];
  const edgeA: { xs: number[]; ys: number[] } = { xs: [], ys: [] };
  const edgeB: { xs: number[]; ys: number[] } = { xs: [], ys: [] };
  const pendingMarks: { x0: number; y0: number; x1: number; y1: number; y: number }[] = [];

  for (const piece of pieces) {
    const first = px.length === 0;

    if (!piece.cross) {
      const { x, y0, y1, style } = piece;
      const steps = Math.max(1, Math.ceil((y1 - y0) / STEP[style]));
      for (let i = first ? 0 : 1; i <= steps; i++) {
        const y = y0 + ((y1 - y0) * i) / steps;
        const fade = smoothstep(0, FADE, y - y0) * smoothstep(0, FADE, y1 - y);
        px.push(x + modulate(style, y - y0) * fade * amplitude);
        py.push(y);
        pstyle.push(style);
      }
      edgeA.xs.push(x + halfTrack, x + halfTrack);
      edgeA.ys.push(y0, y1);
      edgeB.xs.push(x - halfTrack, x - halfTrack);
      edgeB.ys.push(y0, y1);

      if (style === "ticks") {
        // A scale down the content side of the line; every fifth tick is long.
        const inward = x < width / 2 ? 1 : -1;
        for (let k = 0, y = y0 + FADE; y < y1 - FADE; k++, y += 26) {
          const length = (k % 5 === 0 ? 9 : 4) * amplitude;
          pendingMarks.push({ x0: x, y0: y, x1: x + inward * length, y1: y, y });
        }
      }
      continue;
    }

    const { points, apexes } = traceCrossing(piece);
    for (let i = first ? 0 : 1; i < points.length; i++) {
      const p = points[i];
      // Offsets fade out before a corner, so only the stroke style (dashes, hidden) carries through.
      const zoneStyle = zoneStyleAt(p.y);
      px.push(p.x);
      py.push(p.y);
      pstyle.push(zoneStyle === "hidden" || zoneStyle === "fragments" ? zoneStyle : "plain");
      edgeA.xs.push(p.x + p.ty * halfTrack);
      edgeA.ys.push(p.y - p.tx * halfTrack);
      edgeB.xs.push(p.x - p.ty * halfTrack);
      edgeB.ys.push(p.y + p.tx * halfTrack);
    }
    // Apex ticks: a short stroke across the line at the middle of each corner.
    for (const apex of apexes) {
      const nx = apex.ty * 5;
      const ny = -apex.tx * 5;
      pendingMarks.push({ x0: apex.x - nx, y0: apex.y - ny, x1: apex.x + nx, y1: apex.y + ny, y: apex.y });
    }
  }

  const count = px.length;
  if (count < 2) return null;
  const xs = Float32Array.from(px);
  const ys = Float32Array.from(py);
  const ss = new Float32Array(count);
  const areas = new Float64Array(count);
  for (let i = 1; i < count; i++) {
    ss[i] = ss[i - 1] + Math.hypot(xs[i] - xs[i - 1], ys[i] - ys[i - 1]);
    areas[i] = areas[i - 1] + ((ys[i] - ys[i - 1]) * (ss[i] + ss[i - 1])) / 2;
  }

  const runs: Run[] = [];
  for (let i = 0; i < count; i++) {
    const run = runs[runs.length - 1];
    if (run && run.style === pstyle[i]) run.end = i;
    else runs.push({ start: i, end: i, style: pstyle[i] });
  }

  const path = { xs, ys, ss };
  const marks = pendingMarks
    .filter((mark) => !isHidden(mark.y))
    .map(({ y, ...stroke }) => ({ ...stroke, s: lengthAtY(path, y) }))
    .sort((a, b) => a.s - b.s);

  /* ---- Sector boundaries: the grid that forms before each one, and its marker ---- */

  const boundaries: Boundary[] = [];
  const rows = compact ? 2 : 5;
  const pitch = compact ? 30 : 38;
  const fileOffset = compact ? 5 : 9;
  for (let i = 1; i < zones.length; i++) {
    const sector = SECTOR_IDS.indexOf(zones[i].id);
    if (sector < 0 || (zones[i - 1].opaque && zones[i].opaque)) continue;
    const s = lengthAtY(path, seam(zones[i - 1], zones[i]).centre);

    // Two staggered files behind the line, pole position nearest it — as on a real grid.
    const slots: Slot[] = [];
    for (let row = 0; row < rows; row++) {
      for (let file = 0; file < 2; file++) {
        const p = pointAtLength(path, s - 18 - (row + file * 0.5) * pitch);
        const side = file === 0 ? 1 : -1;
        const x = p.x + p.ty * side * fileOffset;
        const y = p.y - p.tx * side * fileOffset;
        if (isHidden(y)) continue;
        slots.push({
          x,
          y,
          ux: p.tx,
          uy: p.ty,
          depth: file === 0 ? 0.9 + row * 0.012 : 1.1 - row * 0.012,
          phase: hash(i * 16 + row * 2 + file),
        });
      }
    }

    const p = pointAtLength(path, s);
    const span = halfTrack + 5;
    const ends = [
      { x: p.x + p.ty * span, y: p.y - p.tx * span },
      { x: p.x - p.ty * span, y: p.y + p.tx * span },
    ];
    // On a corner the track runs across the page, so the label stands above it and points
    // the way the line is travelling — the track falls away on that side and the grid is
    // behind. On a straight it runs down the gutter, so the label reaches in toward the content.
    const acrossPage = Math.abs(p.tx) > Math.abs(p.ty);
    const [near, far] = acrossPage
      ? ends[0].y < ends[1].y
        ? ends
        : [ends[1], ends[0]]
      : Math.abs(ends[0].x - width / 2) < Math.abs(ends[1].x - width / 2)
        ? ends
        : [ends[1], ends[0]];
    const dir = (acrossPage ? p.tx > 0 : near.x < width / 2) ? 1 : -1;

    boundaries.push({
      y: zones[i].top,
      slots,
      marker: {
        label: `SECTOR ${String(sector + 1).padStart(2, "0")}`,
        ax: near.x,
        ay: near.y,
        bx: far.x,
        by: far.y,
        dir,
      },
    });
  }

  return {
    xs,
    ys,
    ss,
    areas,
    runs,
    marks,
    boundaries,
    edges: compact
      ? null
      : [
          { xs: Float32Array.from(edgeA.xs), ys: Float32Array.from(edgeA.ys) },
          { xs: Float32Array.from(edgeB.xs), ys: Float32Array.from(edgeB.ys) },
        ],
    finish: finishY === null ? null : { x: xs[count - 1], y: finishY, s: ss[count - 1] },
    halfTrack,
    slotWidth: compact ? 7 : 13,
    slotDepth: compact ? 6 : 8,
  };
}
