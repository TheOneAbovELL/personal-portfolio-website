"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";
import { useEffect, useState } from "react";
import { ASK_EVENT } from "@/components/nav/events";
import { prefersReducedMotion } from "@/lib/motion";

/**
 * Persistent entry point to Ask Omjee, drawn like the header's Menu control. It appears once
 * the hero has been scrolled past and steps aside while the Ask section or the contact area
 * is on screen. On the homepage it glides to the console and hands it focus, ready to type;
 * elsewhere it is an ordinary link to /#ask. The navigator offers the same thing from its
 * filter: type a question, press Enter.
 */
export function AskButton() {
  const pathname = usePathname();
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
      aria-label="Ask Omjee — question the portfolio"
      tabIndex={visible ? 0 : -1}
      onClick={(event) => {
        const target = document.getElementById("ask");
        if (pathname !== "/" || !target || event.metaKey || event.ctrlKey || event.shiftKey) return;
        event.preventDefault();
        target.scrollIntoView({ behavior: prefersReducedMotion() ? "auto" : "smooth", block: "start" });
        window.history.replaceState(window.history.state, "", "/#ask");
        window.dispatchEvent(new CustomEvent(ASK_EVENT, { detail: {} }));
      }}
      className={`label group fixed bottom-4 right-4 z-40 inline-flex h-10 items-center gap-2.5 border border-rule-strong bg-carbon/80 pl-3.5 pr-4 text-bone backdrop-blur-md transition-[opacity,translate,border-color] duration-[320ms] ease-[var(--ease-out)] hover:border-metal-3 sm:bottom-6 sm:right-6 ${
        visible ? "translate-y-0 opacity-100" : "pointer-events-none translate-y-3 opacity-0"
      }`}
    >
      <span aria-hidden="true" className="readout text-[0.9375rem] leading-none text-data transition-transform duration-[var(--dur-fast)] ease-[var(--ease-snap)] group-hover:translate-x-0.5">
        ›
      </span>
      Ask Omjee
    </Link>
  );
}
