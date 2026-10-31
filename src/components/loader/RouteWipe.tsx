"use client";

import { usePathname } from "next/navigation";
import { useEffect, useState } from "react";

/** The last path this client rendered. Null until hydration, so the first load never wipes. */
let lastPath: string | null = null;

/**
 * The quiet veil and red hairline between pages (client-side navigation only; a full load has the intro
 * instead). Rendered by app/template.tsx beside — never around — the page, so nothing
 * here transforms an ancestor of the page's fixed layers.
 *
 * The decision is made during render, so the wipe commits in the same frame as the new page
 * and the page is never seen uncovered first.
 */
export function RouteWipe() {
  const pathname = usePathname();
  // A remount (the root template re-keys on a new first segment) arriving from another path.
  const [run, setRun] = useState(() => (lastPath !== null && lastPath !== pathname ? 1 : 0));
  // A path change inside the same template instance (e.g. one case study to another).
  const [path, setPath] = useState(pathname);
  if (path !== pathname) {
    setPath(pathname);
    setRun((count) => count + 1);
  }

  useEffect(() => {
    lastPath = pathname;
  }, [pathname]);

  if (!run) return null;
  return (
    <div key={run} className="route-wipe" aria-hidden="true">
      <div className="route-wipe-panel" />
      <div className="route-wipe-line" />
    </div>
  );
}
