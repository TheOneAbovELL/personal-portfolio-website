"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";
import { useCallback, useEffect, useRef, useState, useSyncExternalStore } from "react";
import { initialRaceState, race, type RaceState } from "@/components/race/store";
import { Icon } from "@/components/ui/Icon";
import { Navigator } from "./Navigator";
import { NAVIGATOR_EVENT, isTypingTarget, type NavigatorRequest } from "./events";
import type { NavData } from "./types";

type Route = "home" | "work" | "other";

/* The race store is the single source of truth for where the visitor is on the lap. These
   snapshots change rarely (a zone id, a boolean), so subscribing re-renders the header only
   when the sector changes — never per frame. */
const getZone = () => race.getState().zone;
const getServerZone = () => initialRaceState.zone;

function subscribeToScroll(onChange: () => void) {
  window.addEventListener("scroll", onChange, { passive: true });
  const unsubscribe = race.subscribe(onChange);
  return () => {
    window.removeEventListener("scroll", onChange);
    unsubscribe();
  };
}
// The window's own offset answers before the environment has loaded; the store also covers
// development stills, where the page is held mid-lap without the window scrolling.
const getScrolled = () => window.scrollY > 16 || race.getState().pageProgress > 0.002;
const getServerScrolled = () => false;

type SegmentState = "done" | "active" | "ahead";

/**
 * Sector bar — the bottom edge of the header, as a timing screen draws a lap: one segment per
 * numbered sector, filling as that sector is read. Completed sectors hold in steel, the
 * current one fills in signal yellow, the ones ahead stay dark. On a work page the Work
 * sector fills with the page instead. Fills are written straight to the elements from a
 * store subscription, so scrolling never re-renders React.
 */
function SectorBar({ route, sectors }: { route: Route; sectors: NavData["sectors"] }) {
  const fills = useRef<(HTMLElement | null)[]>([]);

  useEffect(() => {
    const shown: number[] = [];
    const states: SegmentState[] = [];

    const paint = (state: RaceState) => {
      sectors.forEach((sector, index) => {
        const element = fills.current[index];
        if (!element) return;

        let status: SegmentState = "ahead";
        let fill = 0;
        if (route === "home") {
          if (index < state.sectorIndex) status = "done";
          else if (index === state.sectorIndex) status = "active";
          fill = status === "done" ? 1 : status === "active" ? (state.sectors[index] ?? 0) : 0;
        } else if (route === "work" && sector.id === "work") {
          status = "active";
          fill = state.pageProgress;
        }

        // Written to `scale`, the property Tailwind's scale-x-0 resting state uses.
        const rounded = Math.round(fill * 1000) / 1000;
        if (shown[index] !== rounded) {
          shown[index] = rounded;
          element.style.scale = `${rounded} 1`;
        }
        if (states[index] !== status) {
          states[index] = status;
          element.dataset.state = status;
        }
      });
    };

    paint(race.getState());
    return race.subscribe(paint);
  }, [route, sectors]);

  return (
    <div aria-hidden="true" className="shell pointer-events-none absolute inset-x-0 bottom-0">
      <div className="grid h-0.5 gap-px" style={{ gridTemplateColumns: `repeat(${sectors.length}, minmax(0, 1fr))` }}>
        {sectors.map((sector, index) => (
          <span key={sector.id} className="relative block overflow-hidden bg-rule">
            <i
              ref={(element) => {
                fills.current[index] = element;
              }}
              className="absolute inset-0 origin-left scale-x-0 bg-steel transition-colors duration-[var(--dur-fast)] ease-[var(--ease-snap)] data-[state=active]:bg-signal"
            />
          </span>
        ))}
      </div>
    </div>
  );
}

/**
 * On the homepage the name is already on screen as the hero's heading, so the wordmark waits
 * until that heading has passed under the header. Elsewhere it is always shown.
 */
function useHeroPassed(route: Route): boolean {
  const [passed, setPassed] = useState(false);

  useEffect(() => {
    if (route !== "home") return;
    const title = document.getElementById("hero-title");
    if (!title || typeof IntersectionObserver === "undefined") {
      const frame = requestAnimationFrame(() => setPassed(true));
      return () => cancelAnimationFrame(frame);
    }
    const header = parseFloat(getComputedStyle(document.documentElement).getPropertyValue("--header-h")) * 16 || 64;
    const observer = new IntersectionObserver(
      ([entry]) => setPassed(!entry.isIntersecting && entry.boundingClientRect.top < header),
      { rootMargin: `-${header}px 0px 0px 0px` },
    );
    observer.observe(title);
    return () => observer.disconnect();
  }, [route]);

  return route !== "home" || passed;
}

/**
 * The header: a wordmark, where the visitor is, the résumé and one Menu control. Everything
 * else — sectors, pages, every programme, contact — lives in the navigator it opens, which
 * also answers "/" and ⌘K / Ctrl+K from anywhere on the site.
 */
export function HeaderBar({ data }: { data: NavData }) {
  const pathname = usePathname();
  const route: Route = pathname === "/" ? "home" : pathname.startsWith("/work") ? "work" : "other";
  const zone = useSyncExternalStore(race.subscribe, getZone, getServerZone);
  const scrolled = useSyncExternalStore(subscribeToScroll, getScrolled, getServerScrolled);
  const wordmark = useHeroPassed(route);

  const [request, setRequest] = useState<NavigatorRequest | null>(null);
  const menuButton = useRef<HTMLButtonElement>(null);
  const open = request !== null;

  const openNavigator = useCallback((next: NavigatorRequest = {}) => setRequest(next), []);
  const closeNavigator = useCallback(() => setRequest(null), []);

  // "/" and ⌘K / Ctrl+K open the navigator from anywhere — except while the visitor is typing.
  useEffect(() => {
    const onKey = (event: KeyboardEvent) => {
      if (event.defaultPrevented || event.altKey) return;
      const command = (event.metaKey || event.ctrlKey) && event.key.toLowerCase() === "k";
      const slash = event.key === "/" && !event.metaKey && !event.ctrlKey && !isTypingTarget(event.target);
      if (!command && !slash) return;
      event.preventDefault();
      setRequest((current) => (current && command ? null : (current ?? {})));
    };
    const onRequest = (event: Event) => openNavigator((event as CustomEvent<NavigatorRequest>).detail ?? {});
    window.addEventListener("keydown", onKey);
    window.addEventListener(NAVIGATOR_EVENT, onRequest);
    return () => {
      window.removeEventListener("keydown", onKey);
      window.removeEventListener(NAVIGATOR_EVENT, onRequest);
    };
  }, [openNavigator]);

  const here = route === "home" ? data.sectors.find((sector) => sector.id === zone) : undefined;

  return (
    <>
      <header
        className={`fixed inset-x-0 top-0 z-50 border-b transition-[background-color,border-color] duration-[var(--dur-base)] ease-out ${
          scrolled ? "border-rule bg-carbon/80 backdrop-blur-md" : "border-transparent"
        }`}
      >
        <div className="shell grid h-[var(--header-h)] grid-cols-[1fr_auto] items-center gap-6 lg:grid-cols-[1fr_auto_1fr]">
          <Link
            href="/"
            aria-hidden={wordmark ? undefined : true}
            tabIndex={wordmark ? undefined : -1}
            className={`label group flex w-fit items-center gap-2.5 whitespace-nowrap text-[0.75rem] text-bone transition-[opacity,translate] duration-[480ms] ease-[var(--ease-out)] ${
              wordmark ? "translate-y-0 opacity-100" : "pointer-events-none translate-y-1.5 opacity-0"
            }`}
          >
            <span
              aria-hidden="true"
              className="block h-3 w-px bg-perf transition-[height] duration-[var(--dur-fast)] ease-[var(--ease-snap)] group-hover:h-4"
            />
            {data.name}
          </Link>

          {/* Where the visitor is on the lap: one quiet readout instead of a row of links. */}
          <p aria-hidden="true" className="label hidden min-w-[10rem] justify-center text-steel lg:flex">
            {here ? (
              <span key={here.id} className="nav-readout inline-flex items-baseline gap-2">
                <span className="text-signal">{here.number}</span>
                <span className="text-faint">/</span>
                {here.label}
              </span>
            ) : null}
          </p>

          <div className="flex items-center justify-end gap-2 sm:gap-3">
            <a
              href={data.resumeHref}
              target="_blank"
              rel="noopener noreferrer"
              className="label group hidden h-9 items-center gap-1.5 px-2 text-steel transition-colors duration-[var(--dur-fast)] hover:text-bone sm:inline-flex"
            >
              Résumé
              <Icon
                name="arrow-up-right"
                size={12}
                className="transition-transform duration-[var(--dur-fast)] ease-[var(--ease-snap)] group-hover:-translate-y-0.5 group-hover:translate-x-0.5"
              />
            </a>
            <button
              ref={menuButton}
              type="button"
              aria-haspopup="dialog"
              aria-expanded={open}
              aria-controls="navigator"
              aria-keyshortcuts="/ Control+K Meta+K"
              onClick={() => openNavigator()}
              className="nav-menu-button label group -mr-2 inline-flex h-11 items-center gap-3 px-2 text-bone sm:mr-0 sm:h-9 sm:border sm:border-rule-strong sm:pl-3.5 sm:pr-2.5"
            >
              Menu
              <span aria-hidden="true" className="nav-burger">
                <i />
                <i />
              </span>
              {/* The wrapper carries the breakpoint: navigator.css is unlayered and would beat `hidden`. */}
              <span aria-hidden="true" className="hidden lg:inline-flex">
                <kbd className="nav-kbd">/</kbd>
              </span>
            </button>
          </div>
        </div>

        <SectorBar route={route} sectors={data.sectors} />
      </header>

      {/* A sibling of the header, not a child: the header's backdrop filter would otherwise
          become the containing block of this fixed overlay and collapse it. */}
      <Navigator
        data={data}
        request={request}
        onClose={closeNavigator}
        onOpen={openNavigator}
        returnFocus={menuButton}
        zone={route === "home" ? zone : null}
        pathname={pathname}
      />
    </>
  );
}
