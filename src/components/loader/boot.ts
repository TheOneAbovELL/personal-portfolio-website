/**
 * The intro's whole timeline, inlined in the document head (app/layout.tsx) so it runs before —
 * and without — React. Serialised with Function#toString, so it must stay self-contained:
 * no imports, no module-scope references.
 *
 *   0 ms      the name (components/loader/Intro.tsx) rises into its masks — CSS, so it also plays
 *             without script; a red hairline beneath it starts to trace.
 *   …         the hairline follows real readiness only: DOM parsed, the display face loaded,
 *             window load. No percentages, no invented steps.
 *   ready     at the earliest 800 ms (so it never flashes), at the latest 2.2 s (so it never
 *             becomes the wait): the hairline completes and withdraws, and the name glides and
 *             scales into the hero heading's measured place while the backdrop fades. The page's
 *             entrances (paused under `html.intro-hold`) resume as the glide begins.
 *   +1.05 s   the hero's own h1 (hidden under `html.intro-active`) replaces the name in the same
 *             frame; the intro is hidden. Pages without #hero-title (or with it off screen)
 *             simply fade.
 *
 * Any click, key, wheel or touch starts the hand-off at once; scrolling is held until it lands,
 * so the measured target cannot move. Reduced motion: a 300 ms fade, nothing moves.
 * A timer ends everything by 4.8 s whatever happens; without script, CSS lifts the curtain.
 *
 * Development only: `?intro=<ms>` freezes the timeline at that moment (readiness simulated at
 * 900 ms, hand-off at 1000 ms) so it can be screenshot frame by frame.
 */
function introBoot(dev: boolean) {
  const d = document;
  const w = window;
  const root = d.documentElement;
  const t0 = performance.now();

  const MIN = 800;
  const MAX = 2200;
  const SETTLE = 220; // the hairline completing, before the name leaves
  const GLIDE = 1050;
  const FADE = 650;
  const CALM = 300;
  const STILL_READY = 900;
  const STILL_LEAVE = 1000;

  const match = dev ? /[?&]intro=(\d+)/.exec(location.search) : null;
  const still = match ? Number(match[1]) : -1;
  const reduce = w.matchMedia("(prefers-reduced-motion: reduce)").matches;

  root.classList.add("intro-active", "intro-hold");

  let phase = 0; // 0 loading · 1 leaving · 2 done
  let timer = 0;
  let intro: HTMLElement | null = null;
  let name: HTMLElement | null = null;
  let stage: HTMLElement | null = null;
  let rule: HTMLElement | null = null;
  let fill: HTMLElement | null = null;
  let fillAnim: Animation | null = null;
  const live: Animation[] = [];
  const weights: Record<string, number> = { dom: 0.35, fonts: 0.3, load: 0.35 };
  let progress = 0;
  let handing = false;

  const backstop = still < 0 ? w.setTimeout(() => finish(handing), 4800) : 0;
  const ceiling = still < 0 ? w.setTimeout(leave, MAX) : 0;

  // A critically damped spring from rest, normalised to land exactly on 1: quick to leave,
  // long and soft to settle — the way a real mass arrives.
  function spring() {
    const omega = 8.2;
    const end = 1 - (1 + omega) * Math.exp(-omega);
    const points: string[] = [];
    for (let i = 0; i <= 50; i++) {
      const t = i / 50;
      points.push(((1 - (1 + omega * t) * Math.exp(-omega * t)) / end).toFixed(4));
    }
    return "linear(" + points.join(", ") + ")";
  }
  const GLIDE_EASE =
    w.CSS && CSS.supports("transition-timing-function", "linear(0, 1)") ? spring() : "cubic-bezier(0.25, 0.9, 0.3, 1)";
  const FADE_EASE = "cubic-bezier(0.4, 0, 0.2, 1)";

  function setup() {
    if (intro) return true;
    intro = d.getElementById("intro");
    if (!intro) return false;
    name = intro.querySelector<HTMLElement>(".intro-name");
    stage = intro.querySelector<HTMLElement>(".intro-stage");
    rule = intro.querySelector<HTMLElement>(".intro-rule");
    fill = intro.querySelector<HTMLElement>(".intro-rule-fill");
    const family = name ? getComputedStyle(name).fontFamily : "";
    const fonts = () => mark("fonts");
    if (d.fonts && family) Promise.all([d.fonts.load("640 16px " + family), d.fonts.ready]).then(fonts, fonts);
    else fonts();
    if (progress) draw(progress);
    return true;
  }

  function mark(step: string) {
    if (!(step in weights)) return;
    progress += weights[step];
    delete weights[step];
    draw(progress);
    if (!Object.keys(weights).length && still < 0 && !phase) {
      const at = Math.max(MIN, performance.now() - t0 + SETTLE);
      w.clearTimeout(timer);
      timer = w.setTimeout(leave, at - (performance.now() - t0));
    }
  }

  // The hairline eases from wherever it is to the new reading.
  function draw(value: number, duration = 650) {
    if (!fill || phase || still >= 0) return;
    const from = getComputedStyle(fill).transform;
    const next = fill.animate(
      [{ transform: from === "none" ? "scaleX(0)" : from }, { transform: "scaleX(" + Math.min(1, value) + ")" }],
      { duration, easing: "cubic-bezier(0.22, 1, 0.36, 1)", fill: "forwards" },
    );
    if (fillAnim) fillAnim.cancel();
    fillAnim = next;
  }

  function leave() {
    if (phase) return;
    if (!setup() || !intro || !name || !stage) return finish(false);
    phase = 1;
    w.clearTimeout(timer);
    w.clearTimeout(ceiling);
    try {
      if (reduce) calm();
      else if (!glide()) fade();
    } catch {
      finish(false);
    }
  }

  /** Union of the element's text, line by line: [lineCount, width]. */
  function measure(el: Element): [number, number] {
    const walker = d.createTreeWalker(el, NodeFilter.SHOW_TEXT);
    const range = d.createRange();
    const tops: number[] = [];
    let left = Infinity;
    let right = -Infinity;
    for (let node = walker.nextNode(); node; node = walker.nextNode()) {
      if (!node.textContent || !node.textContent.trim()) continue;
      range.selectNodeContents(node);
      const rects = range.getClientRects();
      for (let i = 0; i < rects.length; i++) {
        const r = rects[i];
        if (!r.width) continue;
        left = Math.min(left, r.left);
        right = Math.max(right, r.right);
        if (!tops.some((top) => Math.abs(top - r.top) < r.height / 2)) tops.push(r.top);
      }
    }
    return [tops.length, right - left];
  }

  /** The shared-element hand-off. All reads, then all writes; the transform is computed once. */
  function glide() {
    const hero = d.getElementById("hero-title");
    if (!hero || !intro || !name || !stage) return false;
    const word = name;
    const hs = getComputedStyle(hero);
    const ns = getComputedStyle(name);
    const hr = hero.getBoundingClientRect();
    const nr = name.getBoundingClientRect();
    const sr = stage.getBoundingClientRect();
    const H = parseFloat(hs.fontSize);
    const R = parseFloat(ns.fontSize);
    if (!(H > 0 && R > 0) || !hr.width || hr.bottom < 0 || hr.top > w.innerHeight) return false;

    // Same line structure and the same proportions, or the illusion breaks: fade instead.
    const [heroLines, heroWidth] = measure(hero);
    const nameLines = name.querySelectorAll(".intro-mask").length
      ? new Set(Array.from(name.querySelectorAll(".intro-mask"), (m) => Math.round(m.getBoundingClientRect().top))).size
      : 0;
    if (heroLines !== nameLines || Math.abs((nr.width * H) / R - heroWidth) / heroWidth > 0.04) return false;

    const x0 = nr.left - sr.left;
    const y0 = nr.top - sr.top;
    const x1 = hr.left + parseFloat(hs.paddingLeft) + parseFloat(hs.borderLeftWidth) - sr.left;
    const y1 = hr.top + parseFloat(hs.paddingTop) + parseFloat(hs.borderTopWidth) - sr.top;

    // Writes. The name is re-set at the heading's own size and scaled down to where it is, so
    // the glide ends at scale 1 — crisp, and identical to the heading it becomes.
    stage.style.width = sr.width + "px";
    stage.style.height = sr.height + "px";
    const s = name.style;
    s.position = "absolute";
    s.left = "0px";
    s.top = "0px";
    s.margin = "0px";
    s.transformOrigin = "0 0";
    s.fontSize = H + "px";
    s.lineHeight = hs.lineHeight;
    s.letterSpacing = hs.letterSpacing;
    s.fontWeight = hs.fontWeight;
    s.fontStretch = hs.fontStretch;
    s.fontVariationSettings = hs.fontVariationSettings;

    const move = name.animate(
      [
        { transform: "translate(" + x0 + "px, " + y0 + "px) scale(" + R / H + ")" },
        { transform: "translate(" + x1 + "px, " + y1 + "px) scale(1)" },
      ],
      { duration: GLIDE, easing: GLIDE_EASE, fill: "both" },
    );
    live.push(move);
    handing = true;
    withdraw();
    lift(GLIDE * 0.72, 90);
    root.classList.remove("intro-hold");
    // If the page reflowed under the glide (late hydration, a font swap), settle onto where the
    // heading is now rather than swapping onto a stale position.
    move.finished.then(() => {
      if (phase === 2) return;
      const now = hero.getBoundingClientRect();
      const dx = now.left - hr.left;
      const dy = now.top - hr.top;
      if (Math.abs(dx) < 0.5 && Math.abs(dy) < 0.5) return finish(true);
      const settle = word.animate(
        [
          { transform: "translate(" + x1 + "px, " + y1 + "px)" },
          { transform: "translate(" + (x1 + dx) + "px, " + (y1 + dy) + "px)" },
        ],
        { duration: 240, easing: "cubic-bezier(0.22, 1, 0.36, 1)", fill: "both" },
      );
      live.push(settle);
      settle.finished.then(() => finish(true), () => undefined);
    }, () => undefined);
    return true;
  }

  /** The hairline completes, then draws itself away to the right. */
  function withdraw() {
    if (fill) {
      if (fillAnim) fillAnim.cancel();
      live.push(fill.animate([{ transform: getComputedStyle(fill).transform.replace("none", "scaleX(0)") }, { transform: "scaleX(1)" }], {
        duration: 260,
        easing: "cubic-bezier(0.22, 1, 0.36, 1)",
        fill: "both",
      }));
    }
    if (rule) {
      rule.style.transformOrigin = "100% 50%";
      live.push(rule.animate([{ transform: "scaleX(1)", opacity: 1 }, { transform: "scaleX(0)", opacity: 0 }], {
        duration: 480,
        easing: "cubic-bezier(0.7, 0, 0.2, 1)",
        fill: "both",
      }));
    }
  }

  function lift(duration: number, delay: number) {
    const backdrop = intro && intro.querySelector(".intro-backdrop");
    if (backdrop) {
      live.push(backdrop.animate([{ opacity: 1 }, { opacity: 0 }], { duration, delay, easing: FADE_EASE, fill: "both" }));
    }
  }

  /** No heading to become: the name lifts away with the curtain. */
  function fade() {
    if (!intro || !name) return finish(false);
    root.classList.remove("intro-hold", "intro-active");
    withdraw();
    live.push(name.animate([{ opacity: 1, transform: "none" }, { opacity: 0, transform: "translateY(-0.18em)" }], {
      duration: FADE * 0.8,
      easing: FADE_EASE,
      fill: "both",
    }));
    lift(FADE, 120);
    const out = intro.animate([{ opacity: 1 }, { opacity: 1 }], { duration: FADE + 120, fill: "both" });
    live.push(out);
    out.finished.then(() => finish(false), () => undefined);
  }

  function calm() {
    if (!intro) return finish(false);
    root.classList.add("intro-done");
    root.classList.remove("intro-hold", "intro-active");
    const out = intro.animate([{ opacity: 1 }, { opacity: 0 }], { duration: CALM, easing: "linear", fill: "both" });
    live.push(out);
    out.finished.then(() => finish(true), () => undefined);
  }

  function finish(handed: boolean) {
    if (phase === 2) return;
    phase = 2;
    w.clearTimeout(timer);
    w.clearTimeout(ceiling);
    w.clearTimeout(backstop);
    // One frame: the intro goes, the heading it became is there.
    if (intro) intro.setAttribute("data-state", "done");
    if (handed) root.classList.add("intro-done");
    root.classList.remove("intro-active", "intro-hold");
    unlisten();
    if (still < 0) {
      live.forEach((a) => a.cancel());
      if (fillAnim) fillAnim.cancel();
    }
    d.dispatchEvent(new Event("intro:done"));
  }

  // Skipping. Scroll input is held (not lost to the page) until the name has landed.
  function hold(e: Event) {
    if (phase === 2) return;
    e.preventDefault();
    e.stopImmediatePropagation();
    leave();
  }
  function key(e: KeyboardEvent) {
    if (phase === 2) return;
    if (/^(Arrow|Page|Home|End| |Spacebar)/.test(e.key)) e.preventDefault();
    leave();
  }
  const blocking: AddEventListenerOptions = { capture: true, passive: false };
  function listen() {
    w.addEventListener("wheel", hold, blocking);
    w.addEventListener("touchmove", hold, blocking);
    w.addEventListener("keydown", key, true);
    w.addEventListener("pointerdown", leave, true);
  }
  function unlisten() {
    w.removeEventListener("wheel", hold, blocking);
    w.removeEventListener("touchmove", hold, blocking);
    w.removeEventListener("keydown", key, true);
    w.removeEventListener("pointerdown", leave, true);
  }

  d.addEventListener("intro:abort", () => {
    live.forEach((a) => a.cancel());
    finish(false);
  });

  (function find() {
    if (!setup() && d.readyState === "loading") w.requestAnimationFrame(find);
  })();
  const domReady = () => {
    setup();
    mark("dom");
  };
  if (d.readyState === "loading") d.addEventListener("DOMContentLoaded", domReady);
  else domReady();
  const loaded = new Promise<void>((resolve) => {
    if (d.readyState === "complete") resolve();
    else w.addEventListener("load", () => resolve());
  });
  loaded.then(() => mark("load"));

  if (still < 0) {
    listen();
    return;
  }

  // Development stills: replay the timeline deterministically at `still` ms.
  const fontsReady = d.fonts ? d.fonts.ready : Promise.resolve();
  Promise.all([loaded, fontsReady]).then(() => {
    if (!setup() || !intro) return;
    const at = (list: Animation[], time: number) =>
      list.forEach((a) => {
        a.pause();
        a.currentTime = Math.max(0, time);
      });
    at(intro.getAnimations({ subtree: true }), still);
    if (fill) at([fill.animate([{ transform: "scaleX(0)" }, { transform: "scaleX(1)" }], { duration: STILL_READY, easing: "cubic-bezier(0.22, 1, 0.36, 1)", fill: "both" })], still);
    if (still < STILL_LEAVE) return;
    leave();
    const local = still - STILL_LEAVE;
    at(live, local);
    const entrances = d
      .getAnimations()
      .filter((a) => {
        const target = (a.effect as KeyframeEffect | null)?.target;
        return target instanceof Element && target.matches(".enter, .enter-mask, .enter-fade, .enter-step");
      });
    at(entrances, local);
    if (local >= GLIDE + 200) finish(handing);
  });
}

export const INTRO_BOOT = `(${introBoot.toString()})(${process.env.NODE_ENV !== "production"});`;
