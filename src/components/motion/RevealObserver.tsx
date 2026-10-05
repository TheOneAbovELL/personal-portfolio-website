"use client";

import { usePathname } from "next/navigation";
import { useEffect } from "react";

/**
 * Drives every `[data-reveal]` element on the page from a single IntersectionObserver.
 *
 * Server components opt in with a plain attribute, so reveals cost no extra client
 * components. Without JavaScript — or with reduced motion — the CSS leaves content visible.
 * A MutationObserver picks up elements added later (filtered lists, chat answers).
 */
export function RevealObserver() {
  const pathname = usePathname();

  useEffect(() => {
    const observer = new IntersectionObserver(
      (entries) => {
        for (const entry of entries) {
          // Also reveal anything already above the viewport (anchor jumps, fast scrolls), so
          // scrolling back up never finds content that was skipped and is still hidden.
          if (!entry.isIntersecting && entry.boundingClientRect.bottom > 0) continue;
          (entry.target as HTMLElement).dataset.revealed = "";
          observer.unobserve(entry.target);
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
    };
  }, [pathname]);

  return null;
}
