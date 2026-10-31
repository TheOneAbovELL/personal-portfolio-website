"use client";

import { useEffect, useState, useSyncExternalStore, type RefObject } from "react";
import { prefersReducedMotion } from "@/lib/motion";

/**
 * Helpers shared by the TraceGrade, RAG Workbench, Context Illusion and Inside the Transformers
 * figures. Everything here is deterministic: the same index always gives the same value, so the
 * server and the client render identical markup.
 */

/** A 32-bit integer hash (lowbias32). */
export function hash32(n: number): number {
  let x = n | 0;
  x ^= x >>> 16;
  x = Math.imul(x, 0x7feb352d);
  x ^= x >>> 15;
  x = Math.imul(x, 0x846ca68b);
  x ^= x >>> 16;
  return x >>> 0;
}

/** A value in [0, 1) from a list of integer indices. */
export function unit(...keys: number[]): number {
  let h = 0x9e3779b9;
  for (const k of keys) h = hash32(h ^ hash32(k + 0x632be5ab));
  return h / 4294967296;
}

/** A small seeded generator (mulberry32) for repeatable resampling. */
export function seeded(seed: number): () => number {
  let a = seed >>> 0;
  return () => {
    a = (a + 0x6d2b79f5) >>> 0;
    let t = a;
    t = Math.imul(t ^ (t >>> 15), t | 1);
    t ^= t + Math.imul(t ^ (t >>> 7), t | 61);
    return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
  };
}

const REDUCED_QUERY = "(prefers-reduced-motion: reduce)";

function subscribeReduced(onChange: () => void) {
  const media = window.matchMedia(REDUCED_QUERY);
  media.addEventListener("change", onChange);
  return () => media.removeEventListener("change", onChange);
}

/** Whether the visitor asked for reduced motion. The server (and hydration) assume not. */
export function useReducedMotion(): boolean {
  return useSyncExternalStore(
    subscribeReduced,
    () => window.matchMedia(REDUCED_QUERY).matches,
    () => false,
  );
}

/** Whether the element is on screen (never true under reduced motion — nothing should run). */
export function useOnScreen(ref: RefObject<Element | null>, threshold = 0.35): boolean {
  const [visible, setVisible] = useState(false);
  useEffect(() => {
    const node = ref.current;
    if (!node || prefersReducedMotion()) return;
    const observer = new IntersectionObserver(([entry]) => setVisible(entry.isIntersecting), { threshold });
    observer.observe(node);
    return () => observer.disconnect();
  }, [ref, threshold]);
  return visible;
}
