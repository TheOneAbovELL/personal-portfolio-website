import { PACE } from "./circuit";

/**
 * The qualifying lap: the intro's whole timeline, inlined in the document head (app/layout.tsx)
 * so it runs before — and without — React. Serialised with Function#toString, so it must stay
 * self-contained: no imports, no module-scope references (the pace table is passed in).
 *
 *   0 ms      the circuit draws itself on (CSS, so it also plays without script); the name,
 *             the status line and the timing strip fade up; a red light waits on the line. The
 *             lap clock is already running: it reads the real time since navigation started.
 *   280 ms    the light launches and laps. Its pace comes from an ideal lap (circuit.ts: it brakes
 *             into corners, drives out of them) scaled by reality: each sector is a real loading
 *             stage, and the light eases to a stop short of a sector's line until that stage
 *             is done — it never runs ahead of the page.
 *                S1  document parsed + the display and mono faces loaded
 *                S2  the 3D car's module and geometry (`hero:stage`, components/three)
 *                S3  shaders compiled and the first frame drawn (`hero:ready`)
 *             Pages without the hero: S2 = window load, S3 = the first frame after it.
 *             The sector in progress counts its live elapsed time; the trail behind the light
 *             stretches with its speed; the speed and throttle readouts are instrumentation
 *             derived from the same lap simulation (they describe the light, not the network).
 *             Crossing a line flashes the sector and lights it with its real split; crossing the
 *             finish flashes the line, freezes the clock on the real lap time (time to
 *             `hero:ready` since navigation start) and marks the fastest sector.
 *   +300 ms   the exit: the circuit zooms away, the curtain lifts outward from the car, and the
 *             name glides into the hero heading's place, measured at that moment (pages without
 *             the heading: it fades). The page's entrances (paused under `html.intro-hold`) resume.
 *
 * Typical total 3–5 s. Any click or key skips to the exit as soon as `hero:ready` has fired
 * (waiting at most 1.5 s more); scrolling is held until the name lands. The exit starts by 7 s
 * whatever happens, a timer ends everything by 9 s, and without script CSS lifts the curtain
 * by ~4 s. Reduced motion: a still circuit whose sectors fill in, no counting, then a short fade.
 *
 * Development only: `?intro=<ms>` freezes the timeline at that moment, with the stages
 * simulated at fixed times (S1 420 ms, S2 1480 ms, S3 2210 ms), so it can be screenshot.
 */
function introBoot(dev: boolean, pace: number[]) {
  const d = document;
  const w = window;
  const root = d.documentElement;
  const t0 = performance.now();

  const LAP = 1500; // an unhindered lap, ms
  const LAUNCH = 280; // the light leaves the line
  const SLOW = 0.1; // the light starts easing off this far (in laps) before a closed line
  const SMOOTH = 150; // the light's response time (its mass), ms
  const BEAT = 300; // the lap time, held before the exit
  const SKIP_WAIT = 1500;
  const CEILING = 7000;
  const BACKSTOP = 9000;
  const GLIDE = 1050;
  const LIFT = 1150; // the curtain
  const SIMULATED = [420, 1480, 2210];
  const STEPS = pace.length - 1;
  // Simulated instrumentation only (nothing here measures the network): the ideal lap's top
  // speed on the main straight reads as ~320 km/h.
  let TOP = 0;
  for (let i = 0; i < STEPS; i++) TOP = Math.max(TOP, pace[i + 1] - pace[i]);
  const KMH = 320 / (TOP * STEPS * (1 / LAP));

  const match = dev ? /[?&]intro=(\d+)/.exec(location.search) : null;
  const still = match ? Number(match[1]) : -1;
  const reduce = w.matchMedia("(prefers-reduced-motion: reduce)").matches;

  root.classList.add("intro-active", "intro-hold");

  let phase = 0; // 0 lapping · 1 leaving · 2 done
  let clock = 0; // local ms since boot (simulated when frozen)
  let raf = 0;
  let intro: HTMLElement | null = null;
  let circuit: HTMLElement | null = null;
  let card: HTMLElement | null = null;
  let name: HTMLElement | null = null;
  let ghost: HTMLElement | null = null;
  let status: HTMLElement | null = null;
  let lapTime: HTMLElement | null = null;
  let speedEl: HTMLElement | null = null;
  let throttleEl: HTMLElement | null = null;
  let head: SVGElement | null = null;
  let halo: SVGElement | null = null;
  let finishLine: SVGElement | null = null;
  let wash: HTMLElement | null = null;
  let tails: SVGElement[] = [];
  let tailLengths: number[] = [];
  let rows: HTMLElement[] = [];
  let fills: HTMLElement[] = [];
  let times: (HTMLElement | null)[] = [];
  let chips: (HTMLElement | null)[] = [];
  let cellFlashes: (HTMLElement | null)[] = [];
  let paths: SVGElement[] = [];
  let flashes: SVGElement[] = [];
  let hasHero = false;

  const live: { a: Animation; at: number }[] = [];
  const stageAt = [-1, -1, -1]; // performance.now() when each stage really completed
  const lit = [false, false, false];
  const filled = [-1, -1, -1];
  let domAt = -1;
  let fontAt = -1;
  let tau = 0; // laps of ideal lap time driven
  let rate = 0; // laps per ms
  let stretch = 0; // the trail's length, 0..1 of its full length (follows speed)
  let spd = 0; // the simulated speed readout, km/h
  let thr = 0; // the simulated throttle, 0..1
  let holding = false;
  let lapAt = -1;
  let skipUntil = -1;
  let handing = false;
  let landed: Promise<void> = Promise.resolve();

  const backstop = still < 0 ? w.setTimeout(() => finish(handing), BACKSTOP) : 0;
  const ceiling = still < 0 ? w.setTimeout(() => leave(), CEILING) : 0;

  // A critically damped spring from rest, normalised to land exactly on 1.
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
  const OUT = "cubic-bezier(0.16, 1, 0.3, 1)";
  const SOFT = "cubic-bezier(0.4, 0, 0.2, 1)";

  function setup() {
    if (intro) return true;
    intro = d.getElementById("intro");
    if (!intro || !intro.querySelector(".intro-ghost")) {
      intro = null;
      return false;
    }
    const q = <T extends Element>(s: string) => intro!.querySelector<T>(s);
    circuit = q<HTMLElement>(".intro-circuit");
    card = q<HTMLElement>(".intro-card");
    name = q<HTMLElement>(".intro-name");
    ghost = q<HTMLElement>(".intro-ghost");
    status = q<HTMLElement>(".intro-stage-text");
    lapTime = q<HTMLElement>(".intro-lap-time");
    speedEl = q<HTMLElement>(".intro-speed-value");
    throttleEl = q<HTMLElement>(".intro-throttle-fill");
    head = q<SVGElement>(".ic-head");
    halo = q<SVGElement>(".ic-halo");
    finishLine = q<SVGElement>(".ic-finish");
    wash = q<HTMLElement>(".intro-wash");
    tails = Array.from(intro.querySelectorAll<SVGElement>(".ic-tail"));
    tailLengths = tails.map((t) => Number(t.getAttribute("data-length")) || 0);
    rows = Array.from(intro.querySelectorAll<HTMLElement>(".intro-sector"));
    fills = rows.map((r) => r.querySelector<HTMLElement>(".intro-sector-fill")!);
    times = rows.map((r) => r.querySelector<HTMLElement>(".intro-sector-time"));
    chips = rows.map((r) => r.querySelector<HTMLElement>(".intro-sector-chip"));
    cellFlashes = rows.map((r) => r.querySelector<HTMLElement>(".intro-sector-flash"));
    paths = Array.from(intro.querySelectorAll<SVGElement>(".ic-sector"));
    flashes = Array.from(intro.querySelectorAll<SVGElement>(".ic-flash"));
    if (reduce) intro.setAttribute("data-reduced", "");
    render();
    return true;
  }

  /* Stages ---------------------------------------------------------------------------------- */

  function complete(k: number, at: number) {
    if (stageAt[k] >= 0) return;
    for (let i = 0; i < k; i++) if (stageAt[i] < 0) complete(i, at);
    stageAt[k] = Math.max(at, k ? stageAt[k - 1] : 0);
    say();
  }

  /** The status line narrates the real stages, sector by sector. */
  function say() {
    if (!status || phase) return;
    const text =
      lapAt >= 0
        ? "Lap complete"
        : stageAt[2] >= 0
          ? "Sector 3 · to the line"
          : stageAt[1] >= 0
            ? hasHero
              ? "Sector 3 · compiling shaders"
              : "Sector 3 · first frame"
            : stageAt[0] >= 0
              ? hasHero
                ? "Sector 2 · building the car"
                : "Sector 2 · loading the page"
              : "Out lap · loading fonts";
    if (status.textContent !== text) status.textContent = text;
  }

  function onStage(e: Event) {
    const detail = (e as CustomEvent<{ stage?: string; t?: number }>).detail || {};
    const stage = detail.stage || "";
    if (/geometry|shaders|frame/.test(stage)) complete(1, typeof detail.t === "number" ? detail.t : performance.now());
  }
  function onReady() {
    complete(2, performance.now());
  }
  /** Flags W3 leaves on <html>, in case an event fired before this listened. */
  function poll() {
    const ds = root.dataset;
    if (stageAt[1] < 0 && ds.heroStage && /geometry|shaders|frame/.test(ds.heroStage)) complete(1, performance.now());
    if (stageAt[2] < 0 && ds.hero) complete(2, performance.now());
  }
  function s1() {
    if (domAt >= 0 && fontAt >= 0) complete(0, Math.max(domAt, fontAt));
  }

  /* The lap ----------------------------------------------------------------------------------- */

  /** Track position (pathLength units; 1000 a lap) after `laps` of ideal lap time. */
  function pos(laps: number) {
    const lap = Math.floor(laps);
    const x = (laps - lap) * STEPS;
    const i = Math.min(STEPS - 1, Math.floor(x));
    return lap * 1000 + pace[i] + (pace[i + 1] - pace[i]) * (x - i);
  }

  /** The ideal lap at this point: [distance per step, change of it] — speed and acceleration. */
  function ideal(laps: number): [number, number] {
    const x = (laps - Math.floor(laps)) * STEPS;
    const i = Math.min(STEPS - 1, Math.floor(x));
    const j = Math.min(STEPS - 1, i + 1);
    const s0 = pace[i + 1] - pace[i];
    const s1 = pace[j + 1] - pace[j];
    return [s0, s1 - s0];
  }

  function gate() {
    for (let k = 0; k < 3; k++) if (stageAt[k] < 0) return (k + 1) / 3;
    return Infinity;
  }

  function drive(dt: number) {
    const ease = 1 - Math.exp(-dt / SMOOTH);
    if (clock < LAUNCH) {
      // On the line: the readouts sit at zero, the clock runs.
      spd += (0 - spd) * ease;
      return;
    }
    const g = gate();
    let target = 1 / LAP;
    if (skipUntil >= 0) target *= 1.6;
    if (phase) target *= 0.55; // the cool-down after the line
    const room = g === Infinity ? 1 : Math.max(0, Math.min(1, (g - tau) / SLOW));
    target *= room;
    rate += (target - rate) * ease;
    tau = Math.min(tau + rate * dt, g - 0.0015);
    const hold = room < 0.2;
    if (hold !== holding && intro) {
      holding = hold;
      intro.classList.toggle("is-holding", hold);
    }
    // Instrumentation (simulated): speed from the ideal lap's local pace times the real rate;
    // throttle open when the ideal lap accelerates, lifted when it brakes or a line is closed.
    const [s, a] = ideal(tau);
    const v = s * STEPS * rate; // pathLength units per ms
    spd += (v * KMH - spd) * (1 - Math.exp(-dt / 110));
    const open = a > 0.015 ? 1 : a < -0.015 ? 0.04 : 0.42 + 0.5 * (s / TOP);
    thr += (open * Math.min(1, room * 1.6) * (phase ? 0.4 : 1) - thr) * (1 - Math.exp(-dt / 90));
    stretch += (Math.max(0.12, Math.min(1, (rate * LAP) / 1)) - stretch) * (1 - Math.exp(-dt / 220));
    if (phase) return;
    for (let k = 0; k < 3; k++) if (!lit[k] && tau >= (k + 1) / 3 - 1e-9) light(k);
  }

  function seconds(ms: number) {
    return (Math.max(0, ms) / 1000).toFixed(3);
  }

  function write(el: HTMLElement | null, text: string) {
    if (el && el.textContent !== text) el.textContent = text;
  }

  /** The clock's reading now: the real time since navigation start (or the simulated one). */
  function now() {
    return still >= 0 ? clock : t0 + clock;
  }

  /** Writes: stroke-dashoffset on the light, one transform per bar, the live readouts. */
  function render() {
    if (!intro) return;
    const p = pos(tau);
    const off = String(-p);
    if (head) head.style.strokeDashoffset = off;
    if (halo) halo.style.strokeDashoffset = off;
    for (let i = 0; i < tails.length; i++) {
      const len = tailLengths[i] * stretch;
      tails[i].style.strokeDasharray = len.toFixed(2) + " 4000";
      tails[i].style.strokeDashoffset = (len - p).toFixed(3);
    }
    const bounds = [0, pace[Math.round(STEPS / 3)], pace[Math.round((2 * STEPS) / 3)], 1000];
    for (let k = 0; k < 3; k++) {
      const value = reduce
        ? lit[k]
          ? 1
          : 0
        : tau >= 1
          ? 1
          : Math.max(0, Math.min(1, (p - bounds[k]) / (bounds[k + 1] - bounds[k])));
      if (Math.abs(value - filled[k]) < 0.0005 || !fills[k]) continue;
      filled[k] = value;
      fills[k].style.transform = "scaleX(" + value.toFixed(4) + ")";
    }
    if (reduce || phase) return;
    // The live clock: counts until the lap is really in, then holds the real lap time until the
    // light brings it over the line (it never runs ahead of the page, and never snaps back).
    const t = now();
    if (lapAt < 0) write(lapTime, seconds(stageAt[2] >= 0 ? stageAt[2] : t));
    const cur = Math.min(2, Math.floor(tau * 3));
    for (let k = 0; k <= cur && k < 3; k++) {
      if (lit[k] || (k && stageAt[k - 1] < 0)) continue;
      const from = k ? stageAt[k - 1] : 0;
      write(times[k], seconds((stageAt[k] >= 0 ? stageAt[k] : t) - from));
      if (rows[k] && !rows[k].classList.contains("is-live")) rows[k].classList.add("is-live");
    }
    write(speedEl, String(Math.round(spd)));
    if (throttleEl) throttleEl.style.transform = "scaleX(" + thr.toFixed(3) + ")";
  }

  function play(el: Element | null, frames: Keyframe[], options: KeyframeAnimationOptions) {
    if (!el) return null;
    const a = el.animate(frames, { fill: "both", ...options });
    live.push({ a, at: clock });
    return a;
  }

  function light(k: number) {
    lit[k] = true;
    const row = rows[k];
    const split = stageAt[k] - (k ? stageAt[k - 1] : 0);
    if (row) {
      row.classList.remove("is-live");
      row.classList.add("is-lit");
      write(times[k], seconds(split));
      play(times[k], [{ opacity: 0.4, transform: "translateY(0.3em)" }, { opacity: 1, transform: "none" }], {
        duration: 520,
        easing: OUT,
      });
      // The cell flashes champagne, and a split chip drops in and goes.
      play(cellFlashes[k], [{ opacity: 0 }, { opacity: 1, offset: 0.12 }, { opacity: 0 }], { duration: 720, easing: SOFT });
      if (chips[k]) {
        write(chips[k], "Split");
        play(chips[k], [
          { opacity: 0, transform: "translateY(0.4em) scale(0.92)" },
          { opacity: 1, transform: "none", offset: 0.14 },
          { opacity: 1, transform: "none", offset: 0.72 },
          { opacity: 0, transform: "translateY(-0.3em)" },
        ], { duration: 1500, easing: OUT });
      }
    }
    if (paths[k]) {
      paths[k].classList.add("is-lit");
      play(paths[k], [{ opacity: 0 }, { opacity: 1 }], { duration: 640, easing: OUT });
    }
    // The sector segment flashes bright along its whole length, then settles to its colour.
    play(flashes[k], [{ opacity: 0 }, { opacity: 0.95, offset: 0.1 }, { opacity: 0 }], { duration: 760, easing: SOFT });
    const tick = intro && intro.querySelector('[data-tick="' + k + '"]');
    if (tick) tick.classList.add("is-lit");
    const label = intro && intro.querySelector('[data-label="' + k + '"]');
    if (label) label.classList.add("is-lit");
    if (k === 2) lap();
  }

  function lap() {
    lapAt = clock;
    say();
    if (lapTime) {
      write(lapTime, seconds(stageAt[2]));
      play(lapTime, [{ opacity: 0.5, transform: "translateY(0.25em)" }, { opacity: 1, transform: "none" }], {
        duration: 560,
        easing: OUT,
      });
    }
    // Crossing the line: a rosso flash on the line, and a breath of it across the curtain.
    play(finishLine, [
      { opacity: 0, transform: "scale(1, 0.4)" },
      { opacity: 1, transform: "scale(1.6, 1.9)", offset: 0.22 },
      { opacity: 0, transform: "scale(1, 1.2)" },
    ], { duration: 620, easing: OUT });
    play(wash, [{ opacity: 0 }, { opacity: 1, offset: 0.18 }, { opacity: 0 }], { duration: 720, easing: SOFT });
    // Fastest sector: the one tasteful flourish.
    const splits = stageAt.map((t, k) => t - (k ? stageAt[k - 1] : 0));
    const best = splits.indexOf(Math.min(...splits));
    if (rows[best]) rows[best].classList.add("is-best");
    if (paths[best]) paths[best].classList.add("is-best");
    if (chips[best]) {
      const chip = chips[best]!;
      chip.getAnimations().forEach((a) => a.cancel());
      write(chip, "Fastest");
      play(chip, [{ opacity: 0, transform: "translateY(0.4em)" }, { opacity: 1, transform: "none" }], {
        duration: 520,
        delay: 120,
        easing: OUT,
      });
    }
    if (intro) intro.classList.add("is-complete");
  }

  /* The loop ---------------------------------------------------------------------------------- */

  function step(t: number, dt: number) {
    clock = t;
    if (!setup()) return;
    if (still >= 0) {
      for (let k = 0; k < 3; k++) if (t >= SIMULATED[k]) complete(k, SIMULATED[k]);
    } else poll();
    if (phase === 0) {
      if (reduce) {
        for (let k = 0; k < 3; k++) if (!lit[k] && stageAt[k] >= 0 && (!k || lit[k - 1]) && t >= 300 + k * 160) light(k);
      } else drive(dt);
      render();
      if (lapAt >= 0 && t >= lapAt + (reduce ? 420 : BEAT)) leave();
      else if (skipUntil >= 0 && (stageAt[2] >= 0 || t >= skipUntil)) leave();
      else if (t >= CEILING) leave();
    } else if (phase === 1 && !reduce) {
      drive(dt);
      render();
    }
  }

  function frame() {
    const t = performance.now() - t0;
    const dt = Math.min(50, Math.max(0, t - clock));
    step(t, dt);
    if (phase < 2) raf = w.requestAnimationFrame(frame);
  }

  /* The exit ---------------------------------------------------------------------------------- */

  function leave() {
    if (phase) return;
    if (!setup() || !intro) return finish(false);
    phase = 1;
    w.clearTimeout(ceiling);
    try {
      if (reduce) return calm();
      root.classList.remove("intro-hold");
      origin();
      const handed = glide();
      if (!handed) {
        root.classList.remove("intro-active");
        play(name, [{ opacity: 1 }, { opacity: 0, transform: "translateY(-0.2em)" }], { duration: 520, easing: SOFT });
      }
      // The circuit zooms past: the scale accelerates away while the line fades early.
      play(circuit, [
        { opacity: 1, transform: "scale(1)", easing: "cubic-bezier(0.4, 0, 0.2, 1)" },
        { opacity: 0.35, transform: "scale(1.07)", offset: 0.4, easing: "cubic-bezier(0.3, 0, 0.2, 1)" },
        { opacity: 0, transform: "scale(1.24)" },
      ], { duration: 760 });
      if (card) {
        Array.from(card.children).forEach((el, i) => {
          if (el.querySelector(".intro-name")) {
            if (el.querySelector(".intro-status")) play(el.querySelector(".intro-status"), [{ opacity: 1 }, { opacity: 0 }], { duration: 360, easing: SOFT });
            return;
          }
          play(el, [{ opacity: 1, transform: "none" }, { opacity: 0, transform: "translateY(-0.4rem)" }], {
            duration: 420,
            delay: 40 * i,
            easing: SOFT,
          });
        });
      }
      play(intro.querySelector(".intro-backdrop"), [{ opacity: 1 }, { opacity: 0 }], { duration: 760, delay: 140, easing: SOFT });
      play(intro.querySelector(".intro-vignette"), [
        { opacity: 1, transform: "scale(1)" },
        { opacity: 0, transform: "scale(2.4)" },
      ], { duration: LIFT, delay: 140, easing: "cubic-bezier(0.3, 0, 0.15, 1)" });
      const end = play(intro, [{ opacity: 1 }, { opacity: 1 }], { duration: LIFT + 160 });
      // The intro goes when the curtain is up and the name has landed, whichever is later.
      if (end && still < 0) Promise.all([end.finished, landed]).then(() => finish(handed), () => undefined);
    } catch {
      finish(false);
    }
  }

  /** The curtain lifts outward from the car (its drawing marks where it sits). */
  function origin() {
    const vignette = intro && intro.querySelector<HTMLElement>(".intro-vignette");
    if (!vignette) return;
    const poster = d.querySelector(".hero-poster");
    const r = poster && poster.getBoundingClientRect();
    const x = r && r.width && r.bottom > 0 && r.top < w.innerHeight ? r.left + r.width / 2 : w.innerWidth / 2;
    const y = r && r.width && r.bottom > 0 && r.top < w.innerHeight ? r.top + r.height / 2 : w.innerHeight * 0.55;
    // The vignette is twice the viewport, offset by half of it.
    const ox = x + w.innerWidth / 2;
    const oy = y + w.innerHeight / 2;
    vignette.style.setProperty("--cx", ox + "px");
    vignette.style.setProperty("--cy", oy + "px");
    vignette.style.transformOrigin = ox + "px " + oy + "px";
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

  /**
   * The shared-element hand-off. The ghost is the name set at the heading's own size: it starts
   * scaled down exactly over the card's name and glides to scale 1 on the heading — crisp, and
   * identical to the heading it becomes. The heading is measured here, at hand-off time, so the
   * name lands wherever the hero puts it.
   */
  function glide() {
    const hero = d.getElementById("hero-title");
    if (!hero || !name || !ghost) return false;
    const hr = hero.getBoundingClientRect();
    if (!hr.width || hr.bottom < 0 || hr.top > w.innerHeight) return false;
    const hs = getComputedStyle(hero);
    const nr = name.getBoundingClientRect();
    const g = ghost.style;
    g.fontSize = hs.fontSize;
    g.lineHeight = hs.lineHeight;
    g.letterSpacing = hs.letterSpacing;
    g.fontWeight = hs.fontWeight;
    g.fontStretch = hs.fontStretch;
    g.fontVariationSettings = hs.fontVariationSettings;
    g.fontFamily = hs.fontFamily;
    const [heroLines, heroWidth] = measure(hero);
    const [ghostLines, ghostWidth] = measure(ghost);
    const [nameLines] = measure(name);
    // Same line structure and the same proportions, or the illusion breaks: fade instead.
    if (!ghostWidth || heroLines !== ghostLines || heroLines !== nameLines || Math.abs(ghostWidth - heroWidth) / heroWidth > 0.04) {
      return false;
    }
    const scale = nr.width / ghost.offsetWidth;
    const x1 = hr.left + parseFloat(hs.paddingLeft) + parseFloat(hs.borderLeftWidth);
    const y1 = hr.top + parseFloat(hs.paddingTop) + parseFloat(hs.borderTopWidth);
    const word = ghost;
    const move = play(ghost, [
      { transform: "translate(" + nr.left + "px, " + nr.top + "px) scale(" + scale + ")" },
      { transform: "translate(" + x1 + "px, " + y1 + "px) scale(1)" },
    ], { duration: GLIDE, easing: GLIDE_EASE });
    if (!move) return false;
    ghost.setAttribute("data-on", "");
    name.style.visibility = "hidden";
    handing = true;
    // If the page reflowed under the glide (late hydration, a font swap), settle onto where the
    // heading is now rather than swapping onto a stale position.
    landed = move.finished.then(() => {
      const now = hero.getBoundingClientRect();
      const dx = now.left - hr.left;
      const dy = now.top - hr.top;
      if (phase === 2 || (Math.abs(dx) < 0.5 && Math.abs(dy) < 0.5)) return;
      const settle = play(word, [
        { transform: "translate(" + x1 + "px, " + y1 + "px)" },
        { transform: "translate(" + (x1 + dx) + "px, " + (y1 + dy) + "px)" },
      ], { duration: 240, easing: OUT });
      return settle ? settle.finished.then(() => undefined) : undefined;
    });
    return true;
  }

  function calm() {
    if (!intro) return finish(false);
    root.classList.add("intro-done");
    root.classList.remove("intro-hold", "intro-active");
    const out = play(intro, [{ opacity: 1 }, { opacity: 0 }], { duration: 320, easing: "linear" });
    if (out && still < 0) out.finished.then(() => finish(true), () => undefined);
  }

  function finish(handed: boolean) {
    if (phase === 2) return;
    phase = 2;
    w.cancelAnimationFrame(raf);
    w.clearTimeout(ceiling);
    w.clearTimeout(backstop);
    // One frame: the intro goes, the heading it became is there.
    if (intro) intro.setAttribute("data-state", "done");
    if (handed) root.classList.add("intro-done");
    root.classList.remove("intro-active", "intro-hold");
    unlisten();
    if (still < 0) live.forEach((x) => x.a.cancel());
    d.dispatchEvent(new Event("intro:done"));
  }

  /* Skipping ------------------------------------------------------------------------------------ */

  function skip() {
    if (phase || skipUntil >= 0) return;
    skipUntil = clock + SKIP_WAIT;
  }
  // Scroll input is held (not lost to the page) until the name has landed.
  function hold(e: Event) {
    if (phase === 2) return;
    e.preventDefault();
    e.stopImmediatePropagation();
    skip();
  }
  function key(e: KeyboardEvent) {
    if (phase === 2) return;
    if (/^(Arrow|Page|Home|End| |Spacebar)/.test(e.key)) e.preventDefault();
    skip();
  }
  const blocking: AddEventListenerOptions = { capture: true, passive: false };
  function listen() {
    w.addEventListener("wheel", hold, blocking);
    w.addEventListener("touchmove", hold, blocking);
    w.addEventListener("keydown", key, true);
    w.addEventListener("pointerdown", skip, true);
    w.addEventListener("hero:stage", onStage);
    w.addEventListener("hero:ready", onReady);
  }
  function unlisten() {
    w.removeEventListener("wheel", hold, blocking);
    w.removeEventListener("touchmove", hold, blocking);
    w.removeEventListener("keydown", key, true);
    w.removeEventListener("pointerdown", skip, true);
    w.removeEventListener("hero:stage", onStage);
    w.removeEventListener("hero:ready", onReady);
  }

  d.addEventListener("intro:abort", () => {
    live.forEach((x) => x.a.cancel());
    finish(false);
  });

  /* Boot ---------------------------------------------------------------------------------------- */

  const loaded = new Promise<void>((resolve) => {
    if (d.readyState === "complete") resolve();
    else w.addEventListener("load", () => resolve());
  });

  const domReady = () => {
    setup();
    hasHero = Boolean(d.getElementById("hero-title"));
    if (still >= 0) return;
    domAt = performance.now();
    const fonts = () => {
      fontAt = performance.now();
      s1();
    };
    const family = name ? getComputedStyle(name).fontFamily : "";
    const mono = lapTime ? getComputedStyle(lapTime).fontFamily : "";
    if (d.fonts && family) {
      Promise.all([d.fonts.load("600 16px " + family), mono ? d.fonts.load("400 16px " + mono) : 0, d.fonts.ready]).then(fonts, fonts);
    } else fonts();
    s1();
    // Without the hero there is no car to wait for: the page itself is the lap.
    if (!hasHero) {
      loaded.then(() => {
        complete(1, performance.now());
        w.requestAnimationFrame(() => w.requestAnimationFrame(() => complete(2, performance.now())));
      });
    }
  };
  if (d.readyState === "loading") d.addEventListener("DOMContentLoaded", domReady);
  else domReady();

  if (still < 0) {
    listen();
    raf = w.requestAnimationFrame(frame);
    return;
  }

  // Development stills: replay the timeline deterministically up to `still` ms, then freeze.
  const fontsReady = d.fonts ? d.fonts.ready : Promise.resolve();
  Promise.all([loaded, fontsReady]).then(() => {
    if (!setup() || !intro) return;
    hasHero = Boolean(d.getElementById("hero-title"));
    const css = intro.getAnimations({ subtree: true });
    const dt = 1000 / 240;
    let leftAt = -1;
    for (let t = 0; t <= still && phase < 2; t += dt) {
      const was = phase;
      step(t, dt);
      if (!was && phase) leftAt = t;
    }
    css.forEach((a) => {
      a.pause();
      a.currentTime = still;
    });
    live.forEach((x) => {
      if (x.a.playState === "idle") return; // cancelled (a chip's first run)
      x.a.pause();
      x.a.currentTime = Math.max(0, still - x.at);
    });
    if (leftAt < 0) return;
    const local = still - leftAt;
    d.getAnimations()
      .filter((a) => {
        const target = (a.effect as KeyframeEffect | null)?.target;
        return target instanceof Element && target.matches(".enter, .enter-mask, .enter-fade, .enter-step");
      })
      .forEach((a) => {
        a.pause();
        a.currentTime = local;
      });
    if (local >= GLIDE + 200 && local >= LIFT + 320) finish(handing);
  });
}

export const INTRO_BOOT = `(${introBoot.toString()})(${process.env.NODE_ENV !== "production"}, ${JSON.stringify(PACE)});`;
