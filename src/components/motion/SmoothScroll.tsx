"use client";

import Lenis from "lenis";
import "lenis/dist/lenis.css";
import { usePathname } from "next/navigation";
import { useEffect, useRef } from "react";
import { prefersReducedMotion } from "@/lib/motion";

/**
 * Inertial scrolling for mouse-wheel and trackpad users.
 *
 * Only enabled for fine pointers without a reduced-motion preference; touch devices keep
 * their native scrolling, which is already smooth and should not be second-guessed.
 * Anchor links, keyboard scrolling and find-in-page continue to work.
 */
export function SmoothScroll() {
  const pathname = usePathname();
  const lenisRef = useRef<Lenis | null>(null);

  useEffect(() => {
    if (prefersReducedMotion() || !window.matchMedia("(pointer: fine)").matches) return;

    // A long, soft glide rather than a quick catch-up: each wheel notch closes ~9% of the gap
    // per frame (at 60 Hz; Lenis scales it by frame time), so a burst of notches blends into one
    // continuous move and the page settles without a visible stop.
    const lenis = new Lenis({
      autoRaf: true,
      anchors: true,
      lerp: 0.09,
      wheelMultiplier: 1,
    });
    lenisRef.current = lenis;
    // Development tooling (scroll sweeps, stills) drives the page through the same instance.
    if (process.env.NODE_ENV !== "production") (window as Window & { __lenis?: Lenis }).__lenis = lenis;
    return () => {
      lenis.destroy();
      lenisRef.current = null;
    };
  }, []);

  // A new page starts at the top, unless the URL points at a section.
  useEffect(() => {
    if (!window.location.hash) lenisRef.current?.scrollTo(0, { immediate: true });
  }, [pathname]);

  return null;
}
