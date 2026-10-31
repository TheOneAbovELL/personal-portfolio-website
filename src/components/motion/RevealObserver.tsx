"use client";

import { usePathname } from "next/navigation";
import { useEffect } from "react";
import { prefersReducedMotion } from "@/lib/motion";
import { splitMaskLines } from "@/lib/reveal";

/** The longest a split heading stays split: the slowest tempo's reveal plus its line stagger. */
const SPLIT_TTL = 3200;
/** Body copy arriving with its section heading waits this long after the heading's cue... */
const BODY_BEAT = 480;
/** ...but only when the heading cued within this window; later arrivals are on their own. */
const BEAT_WINDOW = 700;

/**
 * Drives every `[data-reveal]` element on the page from a single IntersectionObserver.
 *
 * Server components opt in with a plain attribute, so reveals cost no extra client
 * components. Without JavaScript — or with reduced motion — the CSS leaves content visible.
 * A MutationObserver picks up elements added later (filtered lists, chat answers).
 *
 * `mask` headings are split into their rendered lines just before they reveal (lib/reveal.ts),
 * so each line rises out of its own clip; the split is undone once the lines have landed.
 */
export function RevealObserver() {
  const pathname = usePathname();

  useEffect(() => {
    const reduced = prefersReducedMotion();
    let fontsReady = document.fonts.status === "loaded";
    void document.fonts.ready.then(() => {
      fontsReady = true;
    });

    // Splits in flight, so a resize (lines would re-wrap) or unmount can undo them at once.
    const splits = new Map<HTMLElement, () => void>();
    const restore = (mask: HTMLElement) => {
      splits.get(mask)?.();
      splits.delete(mask);
      if (splits.size === 0) window.removeEventListener("resize", restoreAll);
    };
    const restoreAll = () => splits.forEach((_, mask) => restore(mask));

    const revealMask = (el: HTMLElement) => {
      const mask = el.querySelector<HTMLElement>(":scope > .mask");
      // Before the display face has loaded the lines would be measured on the fallback font.
      if (!mask || !fontsReady) return;
      const undo = splitMaskLines(mask);
      if (!undo) return;
      if (splits.size === 0) window.addEventListener("resize", restoreAll, { passive: true });
      splits.set(mask, undo);
      // The new lines must be styled in their hidden state before the reveal state applies,
      // or there is nothing to transition from.
      void mask.offsetWidth;
      const lines = mask.querySelectorAll<HTMLElement>(".mask-line-in");
      const last = lines[lines.length - 1];
      const timer = window.setTimeout(() => restore(mask), SPLIT_TTL);
      last.addEventListener(
        "transitionend",
        () => {
          window.clearTimeout(timer);
          restore(mask);
        },
        { once: true },
      );
    };

    // When each section's heading (an h2 mask) was cued, so body copy revealed in the same
    // moment can hold for a beat and arrive after it (layout/Section.tsx, BEAT).
    const cued = new WeakMap<Element, number>();
    const hold = (el: HTMLElement, now: number) => {
      const section = el.closest(".section");
      if (!section) return;
      if (el.dataset.reveal === "mask" && el.tagName === "H2") {
        cued.set(section, now);
        return;
      }
      const at = cued.get(section);
      if (at === undefined || now - at > BEAT_WINDOW || el.style.getPropertyValue("--reveal-delay")) return;
      el.style.setProperty("--reveal-delay", `${Math.max(0, BODY_BEAT - (now - at))}ms`);
    };

    const observer = new IntersectionObserver(
      (entries) => {
        const now = performance.now();
        for (const entry of entries) {
          // Also reveal anything already above the viewport (anchor jumps, fast scrolls), so
          // scrolling back up never finds content that was skipped and is still hidden.
          if (!entry.isIntersecting && entry.boundingClientRect.bottom > 0) continue;
          const el = entry.target as HTMLElement;
          observer.unobserve(el);
          if (!reduced && entry.isIntersecting) {
            hold(el, now);
            // Only what is actually coming into view is worth the line-by-line cut; content
            // already passed (an anchor jump) simply appears.
            if (el.dataset.reveal === "mask") revealMask(el);
          }
          el.dataset.revealed = "";
        }
      },
      { rootMargin: "0px 0px -8% 0px", threshold: 0.05 },
    );

    const watch = (root: ParentNode) =>
      root.querySelectorAll<HTMLElement>("[data-reveal]:not([data-revealed])").forEach((el) => observer.observe(el));
    watch(document);

    const mutations = new MutationObserver((records) => {
      for (const record of records) {
        record.addedNodes.forEach((node) => {
          if (!(node instanceof HTMLElement)) return;
          if (node.matches("[data-reveal]:not([data-revealed])")) observer.observe(node);
          watch(node);
        });
      }
    });
    mutations.observe(document.body, { childList: true, subtree: true });

    return () => {
      observer.disconnect();
      mutations.disconnect();
      restoreAll();
    };
  }, [pathname]);

  return null;
}
