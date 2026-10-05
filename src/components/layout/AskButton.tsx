"use client";

import Link from "next/link";
import { useEffect, useState } from "react";

/**
 * Persistent entry point to Ask Omjee. Appears once the hero has been scrolled past and
 * steps aside while the Ask section or the contact/footer area is on screen.
 */
export function AskButton() {
  const [visible, setVisible] = useState(false);

  useEffect(() => {
    const update = () => {
      const past = window.scrollY > window.innerHeight * 0.8;
      const hide = ["ask", "contact"].some((id) => {
        const rect = document.getElementById(id)?.getBoundingClientRect();
        return rect ? rect.top < window.innerHeight * 0.75 && rect.bottom > window.innerHeight * 0.25 : false;
      });
      setVisible(past && !hide);
    };
    update();
    window.addEventListener("scroll", update, { passive: true });
    return () => window.removeEventListener("scroll", update);
  }, []);

  return (
    <Link
      href="/#ask"
      aria-label="Ask Omjee — query the portfolio"
      tabIndex={visible ? 0 : -1}
      className={`label group fixed bottom-4 right-4 z-40 inline-flex h-11 items-center gap-2.5 border border-rule-strong bg-carbon/85 px-4 text-bone backdrop-blur-md transition-[opacity,transform,border-color,color] duration-[280ms] ease-[var(--ease-snap)] hover:border-signal hover:text-signal sm:bottom-6 sm:right-6 ${
        visible ? "translate-y-0 opacity-100" : "pointer-events-none translate-y-3 opacity-0"
      }`}
    >
      <span aria-hidden="true" className="size-1.5 rounded-full bg-data transition-colors duration-[var(--dur-fast)] group-hover:bg-signal" />
      Ask
    </Link>
  );
}
