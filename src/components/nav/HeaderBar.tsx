"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";
import { useCallback, useEffect, useLayoutEffect, useRef, useState, useSyncExternalStore } from "react";
import type { MouseEvent as ReactMouseEvent, RefObject } from "react";
import { initialRaceState, race } from "@/components/race/store";
import { Icon } from "@/components/ui/Icon";
import { Navigator } from "./Navigator";
import { NAVIGATOR_EVENT, isTypingTarget, type NavigatorRequest } from "./events";
import { scrollToSection } from "./scroll";
import type { NavData, NavSector } from "./types";
import "./navigator.css";

type Route = "home" | "projects" | "work" | "other";

/* The race store is the single source of truth for where the visitor is on the lap. The zone
   changes rarely, so subscribing re-renders the header only when the sector changes — never
   per frame. */
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

const useIsomorphicLayoutEffect = typeof window === "undefined" ? useEffect : useLayoutEffect;

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
 * The header tucks in while the visitor reads down the page and opens out again the moment
 * they scroll back up. Written straight to the element, so scrolling never re-renders React.
 */
function useCompactOnScroll(header: RefObject<HTMLElement | null>) {
  useEffect(() => {
    const element = header.current;
    if (!element) return;
    let last = window.scrollY;
    let frame = 0;
    let compact = false;
    const update = () => {
      frame = 0;
      const y = window.scrollY;
      const delta = y - last;
      if (Math.abs(delta) < 6) return;
      const next = y > 160 && delta > 0;
      last = y;
      if (next !== compact) {
        compact = next;
        if (next) element.dataset.compact = "";
        else delete element.dataset.compact;
      }
    };
    const onScroll = () => {
      if (!frame) frame = requestAnimationFrame(update);
    };
    window.addEventListener("scroll", onScroll, { passive: true });
    return () => {
      window.removeEventListener("scroll", onScroll);
      if (frame) cancelAnimationFrame(frame);
    };
  }, [header]);
}

interface PillItem {
  key: string;
  href: string;
  label: string;
  /** The homepage section it scrolls to, or null for a page. */
  section: string | null;
  /** Position in `site.sections`, for the progress fill. */
  sectorIndex: number;
}

/**
 * The sector pill: a few toggles in one floating capsule. A highlight glides to whichever is
 * current — measured, then moved with a transform on a spring-like curve — and a thin fill
 * inside it reads how far through that sector the visitor is, as a timing screen draws a lap.
 */
function SectorPill({
  items,
  activeKey,
  soft,
  route,
  pathname,
}: {
  items: PillItem[];
  activeKey: string | null;
  /** The visitor is between two toggles (in a sector without one): the highlight rests, dimmed. */
  soft: boolean;
  route: Route;
  pathname: string;
}) {
  const listRef = useRef<HTMLUListElement>(null);
  const capsuleRef = useRef<HTMLSpanElement>(null);
  const fillRef = useRef<HTMLElement>(null);
  const placed = useRef(false);

  // Move the capsule under the active toggle; re-measure when the pill resizes (fonts, viewport).
  useIsomorphicLayoutEffect(() => {
    const list = listRef.current;
    const capsule = capsuleRef.current;
    if (!list || !capsule) return;

    const place = () => {
      const target = activeKey ? list.querySelector<HTMLElement>(`[data-pill="${activeKey}"]`) : null;
      if (!target) {
        capsule.dataset.hidden = "";
        return;
      }
      const first = !placed.current || capsule.dataset.hidden !== undefined;
      if (first) capsule.style.transition = "none";
      capsule.style.transform = `translate3d(${target.offsetLeft}px, 0, 0)`;
      capsule.style.width = `${target.offsetWidth}px`;
      delete capsule.dataset.hidden;
      if (first) {
        void capsule.offsetWidth;
        capsule.style.transition = "";
      }
      placed.current = true;
    };

    place();
    const observer = new ResizeObserver(place);
    observer.observe(list);
    return () => observer.disconnect();
  }, [activeKey]);

  // The fill is written from the store, never through React.
  useEffect(() => {
    const fill = fillRef.current;
    if (!fill) return;
    const active = items.find((item) => item.key === activeKey);
    let shown = -1;
    const paint = () => {
      const state = race.getState();
      let value = 0;
      if (!soft && active) {
        if (route === "home" && active.section) value = state.sectors[active.sectorIndex] ?? 0;
        else if (route !== "home") value = state.pageProgress;
      }
      const rounded = Math.round(value * 1000) / 1000;
      if (rounded !== shown) {
        shown = rounded;
        fill.style.transform = `scaleX(${rounded})`;
      }
    };
    paint();
    return race.subscribe(paint);
  }, [items, activeKey, soft, route]);

  const onClick = (event: ReactMouseEvent<HTMLAnchorElement>, item: PillItem) => {
    if (!item.section || route !== "home") return;
    if (event.metaKey || event.ctrlKey || event.shiftKey || event.button !== 0) return;
    event.preventDefault();
    window.history.replaceState(window.history.state, "", `/#${item.section}`);
    scrollToSection(item.section);
  };

  return (
    <div className="hdr-pill-track">
      <span ref={capsuleRef} aria-hidden="true" className="hdr-capsule" data-hidden="" data-soft={soft ? "" : undefined}>
        <i ref={fillRef} className="hdr-capsule-fill" />
      </span>
      <ul ref={listRef} className="hdr-pill-list">
        {items.map((item) => {
          const active = item.key === activeKey;
          const current = active && !soft ? (item.section ? "location" : "page") : undefined;
          const className = "hdr-pill-item";
          return (
            <li key={item.key}>
              {item.section && route === "home" ? (
                <a
                  href={item.href}
                  data-pill={item.key}
                  aria-current={current}
                  data-active={active ? "" : undefined}
                  className={className}
                  onClick={(event) => onClick(event, item)}
                >
                  {item.label}
                </a>
              ) : (
                <Link
                  href={item.href}
                  data-pill={item.key}
                  aria-current={current ?? (pathname === item.href ? "page" : undefined)}
                  data-active={active ? "" : undefined}
                  className={className}
                >
                  {item.label}
                </Link>
              )}
            </li>
          );
        })}
      </ul>
    </div>
  );
}

/**
 * The header: the wordmark, a floating pill of sector toggles that follows the visitor down the
 * lap, the résumé and one Menu control. Everything else — every sector and page, all thirteen
 * programmes, contact — lives in the navigator it opens, which also answers "/" and ⌘K / Ctrl+K.
 * Phones get the current sector as one compact chip beside Menu.
 */
export function HeaderBar({ data }: { data: NavData }) {
  const pathname = usePathname();
  const route: Route =
    pathname === "/" ? "home" : pathname.startsWith("/projects") ? "projects" : pathname.startsWith("/work") ? "work" : "other";
  const zone = useSyncExternalStore(race.subscribe, getZone, getServerZone);
  const scrolled = useSyncExternalStore(subscribeToScroll, getScrolled, getServerScrolled);
  const wordmark = useHeroPassed(route);

  const [request, setRequest] = useState<NavigatorRequest | null>(null);
  const menuButton = useRef<HTMLButtonElement>(null);
  const headerRef = useRef<HTMLElement>(null);
  const open = request !== null;
  useCompactOnScroll(headerRef);

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

  /* ------------------------------------------------------------ the pill's toggles */

  const sectorIndex = (sector: NavSector) => Number(sector.number) - 1;
  const items: PillItem[] =
    route === "home"
      ? data.sectors
          .filter((sector) => sector.pill)
          .map((sector) => ({
            key: sector.id,
            href: sector.href,
            label: sector.label,
            section: sector.id,
            sectorIndex: sectorIndex(sector),
          }))
      : data.headerPages.map((page) => ({
          key: page.href,
          href: page.href,
          label: page.label,
          section: null,
          sectorIndex: -1,
        }));

  // On the homepage the current toggle is the zone's — or, in a sector without one (Ask), the
  // toggle before it, dimmed. Elsewhere it is the page's.
  let activeKey: string | null = null;
  let soft = false;
  let here: { number: string | null; label: string } | null = null;
  if (route === "home") {
    const zoneSector = data.sectors.find((sector) => sector.id === zone);
    if (zoneSector) {
      here = { number: zoneSector.number, label: zoneSector.label };
      if (zoneSector.pill) activeKey = zoneSector.id;
      else {
        const before = data.sectors.filter((sector) => sector.pill && sectorIndex(sector) < sectorIndex(zoneSector)).pop();
        activeKey = before?.id ?? null;
        soft = true;
      }
    }
  } else {
    const page = route === "projects" ? "/projects" : route === "work" ? "/work" : null;
    activeKey = page;
    const label = data.headerPages.find((link) => link.href === page)?.label;
    here = label ? { number: null, label } : null;
  }

  return (
    <>
      <header
        ref={headerRef}
        className="hdr"
        data-scrolled={scrolled ? "" : undefined}
        data-open={open ? "" : undefined}
      >
        <div className="shell hdr-row">
          <Link
            href="/"
            aria-hidden={wordmark ? undefined : true}
            tabIndex={wordmark ? undefined : -1}
            data-shown={wordmark ? "" : undefined}
            className="hdr-wordmark hdr-island"
          >
            <span aria-hidden="true" className="hdr-wordmark-mark" />
            {data.name}
          </Link>

          <nav aria-label={route === "home" ? "Sectors" : "Pages"} className="hdr-pill hdr-island">
            <SectorPill items={items} activeKey={activeKey} soft={soft} route={route} pathname={pathname} />
          </nav>

          <div className="hdr-actions">
            {/* Phones: where the visitor is, as one chip. It opens the navigator. */}
            <button
              type="button"
              className="hdr-chip hdr-island"
              data-shown={here ? "" : undefined}
              tabIndex={here ? undefined : -1}
              aria-hidden={here ? undefined : true}
              aria-label={here ? `${here.label} — open the navigator` : undefined}
              onClick={() => openNavigator()}
            >
              {here?.number && <span className="hdr-chip-number">{here.number}</span>}
              <span key={here?.label} className="hdr-chip-label">
                {here?.label}
              </span>
            </button>

            <a href={data.resumeHref} target="_blank" rel="noopener noreferrer" className="hdr-resume">
              Résumé
              <Icon name="arrow-up-right" size={12} className="hdr-resume-arrow" />
            </a>
            <button
              ref={menuButton}
              type="button"
              aria-haspopup="dialog"
              aria-expanded={open}
              aria-controls="navigator"
              aria-keyshortcuts="/ Control+K Meta+K"
              onClick={() => openNavigator()}
              className="hdr-menu hdr-island"
            >
              Menu
              <span aria-hidden="true" className="nav-burger">
                <i />
                <i />
              </span>
            </button>
          </div>
        </div>
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
