"use client";

import { useEffect, useRef, useState } from "react";
import { clamp01, prefersReducedMotion, smoothstep } from "@/lib/motion";
import type { HeroScene } from "./scene";

/** How long the server-rendered drawing takes to finish drawing itself (see `draw-on`). */
const POSTER_SETTLE_MS = 2500;
/** Longest the scene waits for the start sequence to hand off before booting anyway. */
const INTRO_TIMEOUT_MS = 9000;
/** Fraction of the hero's height over which the scroll transition plays. */
const SCROLL_RANGE = 0.85;
/** The studio dissolves over the last part of the hero's exit: from this fraction scrolled out, to gone. */
const FADE_FROM = 0.7;

/** Where the hero sits in the document. Measured on resize, so scrolling never reads layout. */
interface Extent {
  top: number;
  height: number;
}

function canUseWebGL(): boolean {
  try {
    const canvas = document.createElement("canvas");
    return Boolean(canvas.getContext("webgl2") ?? canvas.getContext("webgl"));
  } catch {
    return false;
  }
}

/**
 * Run `callback` once the start sequence (components/loader) has handed off — it marks <html>
 * with `intro-active` while it plays. Booting WebGL during it would compete with its animation
 * for the main thread. Returns a cancel function.
 */
function afterIntro(callback: (hadIntro: boolean) => void): () => void {
  const root = document.documentElement;
  const active = () => root.classList.contains("intro-active");
  if (!active()) {
    callback(false);
    return () => {};
  }
  let done = false;
  const finish = () => {
    if (done) return;
    done = true;
    observer.disconnect();
    window.clearTimeout(timer);
    callback(true);
  };
  const observer = new MutationObserver(() => {
    if (!active()) finish();
  });
  observer.observe(root, { attributes: true, attributeFilter: ["class"] });
  const timer = window.setTimeout(finish, INTRO_TIMEOUT_MS);
  return () => {
    done = true;
    observer.disconnect();
    window.clearTimeout(timer);
  };
}

function shouldSaveData(): boolean {
  const connection = (navigator as Navigator & { connection?: { saveData?: boolean } }).connection;
  return Boolean(connection?.saveData);
}

/**
 * The hero's visual layer.
 *
 * `children` is the server-rendered SVG drawing. It is always shown first. On capable
 * devices the WebGL scene is imported once the start sequence has handed off and the browser
 * is idle, rendered once behind the drawing, and then cross-faded in — at which point the
 * drawing turns into an object.
 * Reduced-motion, Save-Data and no-WebGL visitors simply keep the drawing.
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

  useEffect(() => {
    const stage = stageRef.current;
    const canvas = canvasRef.current;
    const hero = stage?.closest("section");
    if (!stage || !canvas || !hero) return;
    if (prefersReducedMotion() || shouldSaveData() || !canUseWebGL()) return;

    const mountedAt = performance.now();
    const extent = extentRef.current;
    let cancelled = false;
    let scene: HeroScene | null = null;
    let observer: IntersectionObserver | null = null;
    let timer = 0;

    const getProgress = () => clamp01((window.scrollY - extent.top) / (extent.height * SCROLL_RANGE));

    let hadIntro = false;
    const boot = async () => {
      const { createHeroScene } = await import("./scene");
      if (cancelled) return;

      // Let the drawing finish before the hand-off so the two never fight. Behind the start
      // sequence the drawing is already complete, so there is nothing to wait for.
      const debugStill = process.env.NODE_ENV !== "production" && window.location.search.includes("hero=");
      const wait = debugStill || hadIntro ? 0 : Math.max(0, POSTER_SETTLE_MS - (performance.now() - mountedAt));
      timer = window.setTimeout(async () => {
        if (cancelled) return;
        const created = createHeroScene({
          canvas,
          stage,
          getProgress,
          intro: window.scrollY < 24,
          onFirstFrame: () => setLive(true),
          onContextLost: () => setLive(false),
        });
        scene = created;
        // Nothing is drawn until the shaders are ready, so the first frame cannot stall.
        await created.ready;
        if (cancelled) return;

        // Dev-only: `?hero=0.5` renders one settled frame at that scroll progress and stops,
        // which makes the scene screenshot-testable in a headless browser.
        if (process.env.NODE_ENV !== "production") {
          const still = new URLSearchParams(window.location.search).get("hero");
          if (still !== null) {
            created.renderStill(Number(still));
            stage.dataset.still = "";
            setLive(true);
            return;
          }
        }

        // Only render while the hero is on screen and the tab is visible.
        observer = new IntersectionObserver(([entry]) => {
          if (entry.isIntersecting && !document.hidden) scene?.start();
          else scene?.stop();
        });
        observer.observe(hero);
      }, wait);
    };

    const onVisibility = () => {
      if (document.hidden) scene?.stop();
      else if (window.scrollY < extent.top + extent.height) scene?.start();
    };
    document.addEventListener("visibilitychange", onVisibility);

    // Import three.js only after the start sequence and once the main thread is idle; it must
    // never delay first paint or take frames from the intro.
    const idle =
      window.requestIdleCallback ?? ((cb: () => void) => window.setTimeout(cb, 250) as unknown as number);
    let idleHandle = 0;
    const cancelIntroWait = afterIntro((intro) => {
      hadIntro = intro;
      idleHandle = idle(() => void boot(), { timeout: intro ? 600 : 2000 });
    });

    return () => {
      cancelled = true;
      cancelIntroWait();
      window.clearTimeout(timer);
      if (idleHandle) window.cancelIdleCallback?.(idleHandle);
      document.removeEventListener("visibilitychange", onVisibility);
      observer?.disconnect();
      scene?.dispose();
    };
  }, []);

  return (
    <div ref={stageRef} className="hero-stage" data-live={live} aria-hidden="true">
      <div className="hero-atmos" />
      <div className="hero-poster">{children}</div>
      <canvas ref={canvasRef} className="hero-canvas" />
    </div>
  );
}
