"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";
import { useEffect, useState } from "react";
import { ASK_EVENT } from "@/components/nav/events";
import { scrollToSection } from "@/components/nav/scroll";
import "@/components/nav/navigator.css";

/**
 * Persistent entry point to Ask Omjee: a floating capsule of the same material as the header. It appears once
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
        scrollToSection("ask");
        window.history.replaceState(window.history.state, "", "/#ask");
        window.dispatchEvent(new CustomEvent(ASK_EVENT, { detail: {} }));
      }}
      data-hidden={visible ? undefined : ""}
      className="ask-fab"
    >
      <span aria-hidden="true" className="ask-fab-mark">
        ›
      </span>
      Ask Omjee
    </Link>
  );
}
