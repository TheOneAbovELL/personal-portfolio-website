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

    const lenis = new Lenis({
      autoRaf: true,
      anchors: true,
      lerp: 0.11,
      wheelMultiplier: 0.95,
    });
    lenisRef.current = lenis;
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
