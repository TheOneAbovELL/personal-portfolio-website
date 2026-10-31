"use client";

import { useEffect, useRef, useState } from "react";
import { clamp01, prefersReducedMotion, smoothstep } from "@/lib/motion";
import type { HeroScene } from "./scene";

/** Fraction of the hero's height over which the scroll transition plays. */
const SCROLL_RANGE = 0.85;
/** The studio dissolves over the last part of the hero's exit: from this fraction scrolled out, to gone. */
const FADE_FROM = 0.7;
/** Frame rate while the loader still covers the page: warm, but not competing with it. */
const COVERED_FPS = 15;

/** Where the hero sits in the document. Measured on resize, so scrolling never reads layout. */
interface Extent {
  top: number;
  height: number;
}

type Stage = "module" | "geometry" | "shaders" | "frame";

function canUseWebGL(): boolean {
  try {
    const canvas = document.createElement("canvas");
    return Boolean(canvas.getContext("webgl2") ?? canvas.getContext("webgl"));
  } catch {
    return false;
  }
}

function shouldSaveData(): boolean {
  const connection = (navigator as Navigator & { connection?: { saveData?: boolean } }).connection;
  return Boolean(connection?.saveData);
}

/**
 * The loader contract (see components/loader). The loader covers the page until the car is
 * ready; these are the milestones it reads. Each is also left on <html> as a data attribute,
 * so a listener that attaches late still finds it.
 */
function emitStage(stage: Stage) {
  document.documentElement.dataset.heroStage = stage;
  window.dispatchEvent(new CustomEvent("hero:stage", { detail: { stage, t: performance.now() } }));
}

function emitReady(mode: "ready" | "fallback") {
  const root = document.documentElement;
  if (root.dataset.hero) return;
  root.dataset.hero = mode;
  window.dispatchEvent(new Event("hero:ready"));
}

/** The loader still covers the page. */
const covered = () => document.documentElement.classList.contains("intro-active");
/** The page's entrances are still held back for the loader's hand-off. */
const held = () => {
  const list = document.documentElement.classList;
  return list.contains("intro-hold") || list.contains("intro-active");
};

const nextFrame = () => new Promise<void>((resolve) => requestAnimationFrame(() => resolve()));

/**
 * The hero's visual layer.
 *
 * `children` is the server-rendered SVG drawing: the poster for visitors without WebGL (or on
 * Save-Data), and what shows for the instant before the scene is live. On capable devices the
 * WebGL scene boots at once, behind the loader — import, geometry, shaders, first frame — and
 * reports each step, so the loader lifts onto a car that is already there and already settled.
 * The arrival (a camera settle and a light sweep) plays as the loader hands over.
 *
 * Either way the studio hands the page over to the race environment as the hero leaves: it
 * fades through `--hero-fade` and is switched off with `data-past` once it is out of view.
 */
export function HeroStage({ children }: { children: React.ReactNode }) {
  const stageRef = useRef<HTMLDivElement>(null);
  const canvasRef = useRef<HTMLCanvasElement>(null);
  const extentRef = useRef<Extent>({ top: 0, height: 1 });
  const [live, setLive] = useState(false);

  // Hand-off. Independent of WebGL so the drawing-only experience behaves the same.
  useEffect(() => {
    const stage = stageRef.current;
    const hero = stage?.closest("section");
    if (!stage || !hero) return;

    const extent = extentRef.current;
    let frame = 0;
    let written = "";

    const apply = () => {
      frame = 0;
      const out = clamp01((window.scrollY - extent.top) / extent.height);
      const fade = smoothstep(FADE_FROM, 1, out).toFixed(3);
      if (fade === written) return;
      written = fade;
      stage.style.setProperty("--hero-fade", fade);
    };
    const measure = () => {
      const rect = hero.getBoundingClientRect();
      extent.top = rect.top + window.scrollY;
      extent.height = Math.max(1, rect.height);
      apply();
    };
    // One style write per frame at most, however often scroll fires.
    const onScroll = () => {
      if (!frame) frame = requestAnimationFrame(apply);
    };

    measure();
    const resizeObserver = new ResizeObserver(measure);
    resizeObserver.observe(hero);
    window.addEventListener("scroll", onScroll, { passive: true });

    const pastObserver = new IntersectionObserver(([entry]) => {
      stage.dataset.past = String(!entry.isIntersecting);
    });
    pastObserver.observe(hero);

    return () => {
      cancelAnimationFrame(frame);
      resizeObserver.disconnect();
      pastObserver.disconnect();
      window.removeEventListener("scroll", onScroll);
    };
  }, []);

  // Pointer parallax for the type: a few pixels against the car's few degrees, so the two
  // layers separate in depth. Fine pointers only; written once per frame while it moves.
  useEffect(() => {
    const hero = stageRef.current?.closest("section");
    if (!hero || prefersReducedMotion() || !window.matchMedia("(pointer: fine)").matches) return;
    const target = { x: 0, y: 0 };
    const shown = { x: 0, y: 0 };
    let frame = 0;
    let last = 0;
    const tick = (now: number) => {
      const dt = Math.min(0.05, (now - last) / 1000 || 0.016);
      last = now;
      const k = 1 - Math.exp(-dt * 4);
      shown.x += (target.x - shown.x) * k;
      shown.y += (target.y - shown.y) * k;
      hero.style.setProperty("--px", shown.x.toFixed(4));
      hero.style.setProperty("--py", shown.y.toFixed(4));
      const settled = Math.abs(target.x - shown.x) < 0.001 && Math.abs(target.y - shown.y) < 0.001;
      frame = settled ? 0 : requestAnimationFrame(tick);
    };
    const onPointerMove = (event: PointerEvent) => {
      target.x = (event.clientX / window.innerWidth) * 2 - 1;
      target.y = (event.clientY / window.innerHeight) * 2 - 1;
      if (!frame && window.scrollY < window.innerHeight) {
        last = performance.now();
        frame = requestAnimationFrame(tick);
      }
    };
    window.addEventListener("pointermove", onPointerMove, { passive: true });
    return () => {
      cancelAnimationFrame(frame);
      window.removeEventListener("pointermove", onPointerMove);
    };
  }, []);

  useEffect(() => {
    const stage = stageRef.current;
    const canvas = canvasRef.current;
    const hero = stage?.closest("section");
    if (!stage || !canvas || !hero) return;
    if (shouldSaveData() || !canUseWebGL()) {
      emitReady("fallback");
      return;
    }

    const motion = !prefersReducedMotion();
    const extent = extentRef.current;
    const root = document.documentElement;
    let cancelled = false;
    let scene: HeroScene | null = null;
    let visible = false;
    let classes: MutationObserver | null = null;
    let observer: IntersectionObserver | null = null;

    // Reduced motion keeps the car at rest: the studio still fades, but the car does not leave.
    const getProgress = () => (motion ? clamp01((window.scrollY - extent.top) / (extent.height * SCROLL_RANGE)) : 0);

    const run = () => {
      if (!scene || !motion) return;
      if (visible && !document.hidden) scene.start();
      else scene.stop();
    };

    const boot = async () => {
      const { createHeroScene } = await import("./scene");
      if (cancelled) return;
      emitStage("module");
      // Let the loader paint between the heavy steps.
      await nextFrame();
      if (cancelled) return;

      const created = createHeroScene({
        canvas,
        stage,
        getProgress,
        motion,
        onContextLost: () => setLive(false),
      });
      scene = created;
      emitStage("geometry");

      // Nothing is drawn until the shaders are ready, so the first frame cannot stall.
      await created.ready;
      if (cancelled) return;
      emitStage("shaders");

      // Dev-only: `?hero=0.5` renders one settled frame at that scroll progress and stops, which
      // makes the scene screenshot-testable in a headless browser; `&sweep=0.4` adds the light.
      const params = new URLSearchParams(window.location.search);
      const still = process.env.NODE_ENV !== "production" ? params.get("hero") : null;
      if (still !== null) {
        const sweepAt = params.get("sweep");
        created.renderStill(Number(still), sweepAt === null ? undefined : Number(sweepAt));
        stage.dataset.still = "";
        setLive(true);
        await nextFrame();
        emitStage("frame");
        emitReady("ready");
        return;
      }

      created.setCadence(covered() ? COVERED_FPS : 0);
      created.renderNow();
      setLive(true);
      await nextFrame();
      if (cancelled) return;
      emitStage("frame");
      emitReady("ready");

      // The arrival plays as the loader hands over: when its hold on the page's entrances ends.
      const arrive = () => {
        created.setCadence(0);
        created.reveal();
        classes?.disconnect();
        classes = null;
      };
      if (!held()) arrive();
      else {
        classes = new MutationObserver(() => {
          if (!covered()) created.setCadence(0);
          if (!held()) arrive();
        });
        classes.observe(root, { attributes: true, attributeFilter: ["class"] });
      }

      // Only render while the hero is on screen and the tab is visible.
      observer = new IntersectionObserver(([entry]) => {
        visible = entry.isIntersecting;
        run();
      });
      observer.observe(hero);
    };

    boot().catch(() => {
      if (cancelled) return;
      setLive(false);
      emitReady("fallback");
    });

    document.addEventListener("visibilitychange", run);

    return () => {
      cancelled = true;
      document.removeEventListener("visibilitychange", run);
      classes?.disconnect();
      observer?.disconnect();
      scene?.dispose();
    };
  }, []);

  return (
    <div ref={stageRef} className="hero-stage" data-live={live} aria-hidden="true">
      <div className="hero-atmos" />
      <div className="hero-poster">{children}</div>
      <canvas ref={canvasRef} className="hero-canvas" />
      <div className="hero-vignette" />
    </div>
  );
}
