"use client";

import { usePathname } from "next/navigation";
import { useEffect, useState } from "react";

/**
 * Owns the intro node's lifetime in React. The intro runs itself (boot.ts, before hydration)
 * and hides itself when done; this only removes it on the first client-side navigation, and
 * clears the classes it set on <html> so a later visit to the hero plays its own entrance.
 */
export function IntroGate({ children }: { children: React.ReactNode }) {
  const pathname = usePathname();
  const [first] = useState(pathname);
  const [gone, setGone] = useState(false);
  if (!gone && pathname !== first) setGone(true);

  useEffect(() => {
    if (!gone) return;
    document.dispatchEvent(new Event("intro:abort"));
    document.documentElement.classList.remove("intro-active", "intro-hold", "intro-done");
  }, [gone]);

  return gone ? null : children;
}
