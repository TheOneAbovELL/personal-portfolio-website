"use client";

import { usePathname } from "next/navigation";
import { useEffect, useRef, useState } from "react";

/** After the curtain is up, how long the (invisible) node stays so no entrance timing shifts under it. */
const LINGER_MS = 6000;

/**
 * Owns the start sequence's lifetime. The sequence itself is CSS; this only
 *   - marks it `data-state="done"` once the curtain has lifted (the hero's WebGL car may then
 *     cross-fade in — see styles/hero.css), and
 *   - removes the node a while later, or at once on the first client-side navigation.
 *
 * While the node exists, `html:has(#intro)` holds page entrances back until the curtain lifts,
 * so removal waits until those entrances have played: changing their delay mid-flight would jump.
 */
export function IntroGate({ children }: { children: React.ReactNode }) {
  const [gone, setGone] = useState(false);
  const pathname = usePathname();
  const firstPath = useRef(pathname);

  useEffect(() => {
    if (pathname !== firstPath.current) setGone(true);
  }, [pathname]);

  useEffect(() => {
    const intro = document.getElementById("intro");
    if (!intro) return;

    let cancelled = false;
    let timer = 0;
    const finish = () => {
      if (cancelled) return;
      intro.dataset.state = "done";
      timer = window.setTimeout(() => setGone(true), LINGER_MS);
    };

    // The curtain's lift (or the reduced-motion fade) is the root's only animation.
    const curtain = intro.getAnimations?.()[0];
    if (!curtain || curtain.playState === "finished") finish();
    else curtain.finished.then(finish, finish);

    return () => {
      cancelled = true;
      window.clearTimeout(timer);
    };
  }, []);

  return gone ? null : children;
}
