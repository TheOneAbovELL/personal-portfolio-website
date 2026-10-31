"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";
import { useEffect, useState } from "react";
import { ASK_EVENT } from "@/components/nav/events";
import { scrollFrame } from "@/components/nav/frame";
import { scrollToSection } from "@/components/nav/scroll";
import "@/components/nav/navigator.css";

/** Where the Ask console and the contact area sit on the page, in document pixels. */
interface Band {
  top: number;
  bottom: number;
}

/**
 * Persistent entry point to Ask Omjee: a floating capsule of the same material as the header. It appears once
 * the hero has been scrolled past and steps aside while the Ask section or the contact area
 * is on screen. On the homepage it glides to the console and hands it focus, ready to type;
 * elsewhere it is an ordinary link to /#ask. The navigator offers the same thing from its
 * filter: type a question, press Enter.
 *
 * The sections it yields to are measured when the page's layout changes, not while it scrolls:
 * each frame compares the cached offset against those bands and nothing else.
 */
export function AskButton() {
  const pathname = usePathname();
  const [visible, setVisible] = useState(false);

  useEffect(() => {
    let bands: Band[] = [];
    let height = window.innerHeight;

    const measure = () => {
      height = window.innerHeight;
      const y = window.scrollY;
      bands = ["ask", "contact"].flatMap((id) => {
        const rect = document.getElementById(id)?.getBoundingClientRect();
        return rect ? [{ top: rect.top + y, bottom: rect.bottom + y }] : [];
      });
      update();
    };

    const update = () => {
      const y = scrollFrame.getY();
      const past = y > height * 0.8;
      const hide = bands.some((band) => band.top - y < height * 0.75 && band.bottom - y > height * 0.25);
      setVisible(past && !hide);
    };

    // The page grows as it loads (programmes, the Garage): follow the body, not just the window.
    const observer = new ResizeObserver(measure);
    observer.observe(document.body);
    const unsubscribe = scrollFrame.subscribe(update);
    measure();
    return () => {
      observer.disconnect();
      unsubscribe();
    };
  }, [pathname]);

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
