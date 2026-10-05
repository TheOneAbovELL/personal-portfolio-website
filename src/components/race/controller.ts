import { clamp, clamp01, damp } from "@/lib/motion";
import { readDevStill } from "./dev";
import { measureLayout } from "./layout";
import { buildRaceLine } from "./line";
import { toCss, type Frame } from "./painters/frame";
import { paintGrid, paintMarkers } from "./painters/grid";
import { paintRacingLine } from "./painters/racingLine";
import { paintTelemetry } from "./painters/telemetry";
import { paintTrack } from "./painters/track";
import {
  accentOf,
  atmosphereAt,
  clearAtmosphere,
  createAtmosphere,
  easeAtmosphere,
  writeAtmosphere,
} from "./palettes";
import { locate, readingY } from "./position";
import { initialRaceState, race, type RaceState } from "./store";

/**
 * The environment controller: the one requestAnimationFrame loop behind the page.
 *
 * Each frame it reads a single value from the document — window.scrollY — derives everything
 * else from the layout measured earlier, publishes the race state, writes the atmosphere's
 * custom properties and repaints the canvas. The loop runs only while something is changing
 * (the page is moving, a value is still easing, the interface reports activity) and stops
 * when everything has settled; scroll, resize and `race.setActivity` wake it again.
 */
export interface RaceController {
  /** Re-measure the page, e.g. after a route change. */
  refresh(): void;
  destroy(): void;
}

/* Time constants, in seconds. Energy attacks fast and decays slowly: that asymmetry is the inertia. */
const VELOCITY_TAU = 0.12;
const ATTACK_TAU = 0.09;
const DECAY_TAU = 0.6;
const ACTIVITY_TAU = 0.3;
const ATMOSPHERE_TAU = 0.18;

/** Scroll speed, in viewport heights per second, at which energy saturates. */
const FULL_SPEED = 2.4;
/** Jumps (anchor links, Home/End) are not speed; cap what one frame can report. */
const MAX_SPEED = 12;
/** Below this, an easing value counts as arrived. */
const SETTLED = 0.004;
const MAX_PIXEL_RATIO = 1.5;

const near = (a: number, b: number) => Math.abs(a - b) < 0.0005;

function sameState(a: RaceState, b: RaceState): boolean {
  return (
    a.zone === b.zone &&
    a.sectorIndex === b.sectorIndex &&
    a.reducedMotion === b.reducedMotion &&
    near(a.zoneProgress, b.zoneProgress) &&
    near(a.pageProgress, b.pageProgress) &&
    near(a.velocity, b.velocity) &&
    near(a.energy, b.energy) &&
    near(a.boundary, b.boundary) &&
    near(a.activity, b.activity) &&
    a.sectors.length === b.sectors.length &&
    a.sectors.every((value, index) => near(value, b.sectors[index]))
  );
}

export function createRaceController(env: HTMLElement, canvas: HTMLCanvasElement): RaceController {
  const ctx = canvas.getContext("2d");
  const motionQuery = window.matchMedia("(prefers-reduced-motion: reduce)");
  const devStill = process.env.NODE_ENV !== "production" ? readDevStill() : null;
  let holding = devStill !== null;
  // A development still pulls the page up instead of scrolling it (see dev.ts); adding its
  // offset back keeps every position below in true page space.
  const pageOffset = () => (holding && devStill ? devStill.offset : 0);

  let layout = measureLayout(env, 0);
  let line = buildRaceLine(layout);
  let mono = "ui-monospace, monospace";

  let running = false;
  let frameId = 0;
  let lastTime = 0;
  let lastY = window.scrollY;

  let velocity = 0;
  let energy = 0;
  let drift = 0;
  let activity = 0;

  const target = createAtmosphere();
  const shown = createAtmosphere();
  const written: string[] = [];
  let lit = false;
  const sectors: number[] = [];

  const sizeCanvas = () => {
    const ratio = layout.coarse ? 1 : Math.min(window.devicePixelRatio || 1, MAX_PIXEL_RATIO);
    const width = Math.round(layout.width * ratio);
    const height = Math.round(layout.height * ratio);
    if (canvas.width !== width || canvas.height !== height) {
      canvas.width = width;
      canvas.height = height;
    }
    ctx?.setTransform(ratio, 0, 0, ratio, 0, 0);
  };

  const readFont = () => {
    const family = getComputedStyle(document.body).getPropertyValue("--font-plex-mono").trim();
    mono = family ? `${family}, ui-monospace, monospace` : "ui-monospace, monospace";
  };

  const tick = (now: number) => {
    const dt = clamp((now - lastTime) / 1000, 0.004, 0.05);
    lastTime = now;
    const y = window.scrollY + pageOffset();
    const moved = y !== lastY;
    const reduced = motionQuery.matches;
    const wanted = race.getActivityTarget();

    if (holding && devStill) {
      velocity = 0;
      energy = devStill.energy;
      drift = devStill.energy;
      activity = devStill.activity;
    } else if (reduced) {
      // Reduced motion: position still drives colour, but nothing responds to speed.
      velocity = 0;
      energy = 0;
      drift = 0;
      activity = wanted;
    } else {
      const speed = clamp((y - lastY) / dt / layout.height, -MAX_SPEED, MAX_SPEED);
      velocity = damp(velocity, speed, VELOCITY_TAU, dt);
      const push = clamp01(Math.abs(velocity) / FULL_SPEED);
      energy = damp(energy, push, push > energy ? ATTACK_TAU : DECAY_TAU, dt);
      const lean = clamp(velocity / FULL_SPEED, -1, 1);
      drift = damp(drift, lean, Math.abs(lean) > Math.abs(drift) ? ATTACK_TAU : DECAY_TAU, dt);
      activity = damp(activity, wanted, ACTIVITY_TAU, dt);
    }
    lastY = y;

    const readY = readingY(layout, y);
    atmosphereAt(layout, readY, target);
    // The first frame, stills and reduced motion take the colour as it is; otherwise it eases,
    // so a jump across the page (an anchor link) still arrives as changing light.
    const instant = !lit || reduced || holding;
    const colourGap = easeAtmosphere(shown, target, instant ? 0 : Math.exp(-dt / ATMOSPHERE_TAU));
    lit = true;

    // Settle: once nothing is moving and every eased value has arrived, land exactly and stop.
    const sweeping = activity > SETTLED && !reduced;
    const easing =
      Math.abs(velocity) > SETTLED ||
      energy > SETTLED ||
      Math.abs(drift) > SETTLED ||
      Math.abs(activity - wanted) > SETTLED ||
      colourGap > SETTLED;
    const busy = !holding && (moved || easing || sweeping);
    if (!busy && !holding) {
      velocity = 0;
      energy = 0;
      drift = 0;
      activity = wanted;
      easeAtmosphere(shown, target, 0);
    }

    writeAtmosphere(env, shown, written);

    const place = locate(layout, readY, sectors);
    const next: RaceState = {
      ...place,
      pageProgress: clamp01(y / Math.max(1, layout.pageHeight - layout.height)),
      sectors,
      velocity,
      energy,
      activity,
      reducedMotion: reduced,
    };
    if (!sameState(race.getState(), next)) race.setState({ ...next, sectors: sectors.slice() });

    if (ctx) {
      ctx.clearRect(0, 0, layout.width, layout.height);
      if (line) {
        const frame: Frame = {
          ctx,
          width: layout.width,
          height: layout.height,
          scrollY: Math.round(y),
          readY,
          accent: toCss(accentOf(shown)),
          energy,
          drift,
          activity,
          time: holding && devStill ? devStill.time : now / 1000,
          still: reduced,
          compact: layout.compact,
          mono,
        };
        paintTrack(frame, line);
        paintGrid(frame, line);
        paintRacingLine(frame, line);
        paintMarkers(frame, line);
        paintTelemetry(frame, line);
      }
    }

    running = busy;
    if (busy) frameId = requestAnimationFrame(tick);
  };

  const wake = () => {
    if (running) return;
    running = true;
    lastTime = performance.now();
    frameId = requestAnimationFrame(tick);
  };

  const applyLayout = () => {
    if (holding) devStill?.aim(layout);
    sizeCanvas();
    wake();
  };

  const measure = () => {
    layout = measureLayout(env, pageOffset());
    line = buildRaceLine(layout);
    applyLayout();
  };

  // The first real input ends a development still and hands the page back.
  const release = () => {
    devStill?.release();
    holding = false;
    measure();
  };
  const RELEASE_EVENTS = ["wheel", "touchstart", "keydown", "pointerdown"] as const;
  if (devStill) RELEASE_EVENTS.forEach((type) => window.addEventListener(type, release, { passive: true, once: true }));

  // Zones move when the page grows or reflows (fonts, answers, filters); the viewport when
  // the window — or a mobile browser's toolbar — resizes.
  const observer = new ResizeObserver(measure);
  observer.observe(document.body);
  observer.observe(env);
  window.addEventListener("scroll", wake, { passive: true });
  motionQuery.addEventListener("change", wake);
  race.onWake(wake);

  let destroyed = false;
  void document.fonts.ready.then(() => {
    if (destroyed) return;
    readFont();
    wake();
  });

  readFont();
  applyLayout();

  return {
    refresh: measure,
    destroy() {
      destroyed = true;
      cancelAnimationFrame(frameId);
      running = false;
      observer.disconnect();
      window.removeEventListener("scroll", wake);
      RELEASE_EVENTS.forEach((type) => window.removeEventListener(type, release));
      motionQuery.removeEventListener("change", wake);
      race.onWake(null);
      race.setState(initialRaceState);
      clearAtmosphere(env);
      ctx?.clearRect(0, 0, layout.width, layout.height);
    },
  };
}
