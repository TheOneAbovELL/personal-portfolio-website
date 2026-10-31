"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";
import { Fragment, useEffect, useRef, useState, useSyncExternalStore } from "react";
import { initialRaceState, race, type RaceState } from "@/components/race/store";
import { Icon } from "@/components/ui/Icon";
import { profile } from "@/content/profile";
import { site } from "@/content/site";

const SECTORS = site.sections.map((section, index) => ({
  ...section,
  number: String(index + 1).padStart(2, "0"),
}));
const NAV = SECTORS.filter((section) => section.nav);

/** Pages beside the sectors (site.routes), keyed by the sector each one follows. */
const ROUTES_AFTER = new Map<string, (typeof site.routes)[number][]>();
for (const page of site.routes) ROUTES_AFTER.set(page.after, [...(ROUTES_AFTER.get(page.after) ?? []), page]);

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
function SectorBar({ route }: { route: Route }) {
  const fills = useRef<(HTMLElement | null)[]>([]);

  useEffect(() => {
    const shown: number[] = [];
    const states: SegmentState[] = [];

    const paint = (state: RaceState) => {
      SECTORS.forEach((sector, index) => {
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
  }, [route]);

  return (
    <div aria-hidden="true" className="shell pointer-events-none absolute inset-x-0 bottom-0">
      <div className="grid h-0.5 gap-px" style={{ gridTemplateColumns: `repeat(${SECTORS.length}, minmax(0, 1fr))` }}>
        {SECTORS.map((sector, index) => (
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
 * A page link beside the sector links. Same type, lamp and underline as a sector, but no
 * sector number: a page is not a sector of the lap, so its slot carries a route mark instead.
 */
function RouteLink({ href, label, current }: { href: string; label: string; current: boolean }) {
  return (
    <Link
      href={href}
      aria-current={current ? "page" : undefined}
      className={`label group relative flex items-baseline gap-1.5 whitespace-nowrap py-2 transition-colors duration-[var(--dur-fast)] hover:text-bone ${
        current ? "text-bone" : "text-steel"
      }`}
    >
      <span
        aria-hidden="true"
        className={`absolute -left-2.5 top-1/2 size-[5px] -translate-y-1/2 bg-signal transition-[opacity,translate] duration-[220ms] ease-[var(--ease-snap)] ${
          current ? "opacity-100" : "-translate-x-1 opacity-0"
        }`}
      />
      <span
        aria-hidden="true"
        className={`text-[0.5625rem] transition-colors duration-[var(--dur-fast)] ${
          current ? "text-signal" : "text-faint group-hover:text-signal"
        }`}
      >
        /
      </span>
      {label}
      <span
        aria-hidden="true"
        className={`absolute -bottom-0.5 -left-2.5 right-0 h-px origin-left bg-signal transition-transform duration-[280ms] ease-[var(--ease-snap)] ${
          current ? "scale-x-100" : "scale-x-0 group-hover:scale-x-[0.35]"
        }`}
      />
    </Link>
  );
}

export function Header() {
  const pathname = usePathname();
  const route: Route = pathname === "/" ? "home" : pathname.startsWith("/work") ? "work" : "other";
  const zone = useSyncExternalStore(race.subscribe, getZone, getServerZone);
  const scrolled = useSyncExternalStore(subscribeToScroll, getScrolled, getServerScrolled);
  const [open, setOpen] = useState(false);
  const menuButton = useRef<HTMLButtonElement>(null);

  // While the mobile menu is open: lock scroll, close on Escape, return focus on close.
  useEffect(() => {
    if (!open) return;
    const button = menuButton.current;
    const onKey = (event: KeyboardEvent) => {
      if (event.key === "Escape") setOpen(false);
    };
    document.body.style.overflow = "hidden";
    window.addEventListener("keydown", onKey);
    return () => {
      document.body.style.overflow = "";
      window.removeEventListener("keydown", onKey);
      button?.focus();
    };
  }, [open]);

  const isCurrent = (id: string) => (route === "home" ? zone === id : route === "work" && id === "work");

  return (
    <>
      <header
        className={`fixed inset-x-0 top-0 z-50 border-b transition-[background-color,border-color] duration-[var(--dur-base)] ease-out ${
          scrolled || open ? "border-rule bg-carbon/85 backdrop-blur-md" : "border-transparent"
        }`}
      >
        <div className="shell flex h-[var(--header-h)] items-center justify-between gap-6">
          <Link
            href="/"
            className="label group flex shrink-0 items-center gap-2.5 whitespace-nowrap text-[0.75rem] text-bone"
            onClick={() => setOpen(false)}
          >
            <span
              aria-hidden="true"
              className="block h-3 w-px bg-signal transition-[height] duration-[var(--dur-fast)] ease-[var(--ease-snap)] group-hover:h-4"
            />
            {profile.name}
          </Link>

          <nav aria-label="Primary" className="hidden items-center gap-5 lg:flex xl:gap-8">
            <ul className="flex items-center gap-5 xl:gap-7">
              {NAV.map((item) => {
                const current = isCurrent(item.id);
                return (
                  <Fragment key={item.id}>
                    <li>
                      <Link
                        href={`/#${item.id}`}
                        aria-current={current ? "location" : undefined}
                        className={`label group relative flex items-baseline gap-1.5 whitespace-nowrap py-2 transition-colors duration-[var(--dur-fast)] hover:text-bone ${
                          current ? "text-bone" : "text-steel"
                        }`}
                      >
                        {/* Sector light: a square lamp that snaps on beside the current sector. */}
                        <span
                          aria-hidden="true"
                          className={`absolute -left-2.5 top-1/2 size-[5px] -translate-y-1/2 bg-signal transition-[opacity,translate] duration-[220ms] ease-[var(--ease-snap)] ${
                            current ? "opacity-100" : "-translate-x-1 opacity-0"
                          }`}
                        />
                        <span
                          aria-hidden="true"
                          className={`text-[0.5625rem] transition-colors duration-[var(--dur-fast)] ${
                            current ? "text-signal" : "text-faint group-hover:text-signal"
                          }`}
                        >
                          {item.number}
                        </span>
                        {item.label}
                        {/* The line snaps in from the lamp under the current item, and previews on hover. */}
                        <span
                          aria-hidden="true"
                          className={`absolute -bottom-0.5 -left-2.5 right-0 h-px origin-left bg-signal transition-transform duration-[280ms] ease-[var(--ease-snap)] ${
                            current ? "scale-x-100" : "scale-x-0 group-hover:scale-x-[0.35]"
                          }`}
                        />
                      </Link>
                    </li>
                    {ROUTES_AFTER.get(item.id)?.map((page) => (
                      <li key={page.href}>
                        <RouteLink href={page.href} label={page.label} current={pathname.startsWith(page.href)} />
                      </li>
                    ))}
                  </Fragment>
                );
              })}
            </ul>
            <a
              href={profile.resume.href}
              target="_blank"
              rel="noopener noreferrer"
              className="label group inline-flex h-9 shrink-0 items-center gap-2 whitespace-nowrap border border-rule-strong px-3.5 text-bone transition-colors duration-[var(--dur-fast)] hover:border-signal hover:text-signal"
            >
              Résumé
              <Icon
                name="arrow-up-right"
                size={12}
                className="transition-transform duration-[var(--dur-fast)] ease-[var(--ease-snap)] group-hover:-translate-y-0.5 group-hover:translate-x-0.5"
              />
            </a>
          </nav>

          <button
            ref={menuButton}
            type="button"
            className="label -mr-2 inline-flex h-11 items-center gap-2 px-2 text-bone lg:hidden"
            aria-expanded={open}
            aria-controls="mobile-menu"
            onClick={() => setOpen((value) => !value)}
          >
            {open ? "Close" : "Menu"}
            <Icon name={open ? "close" : "menu"} size={18} />
          </button>
        </div>

        <SectorBar route={route} />
      </header>

      {/* A sibling of the header, not a child: the header's backdrop filter would otherwise
          become the containing block of this fixed panel and collapse it. */}
      {open && (
        <div
          id="mobile-menu"
          className="fixed inset-x-0 bottom-0 top-[var(--header-h)] z-40 overflow-y-auto bg-carbon lg:hidden"
        >
          <nav aria-label="Primary" className="shell flex min-h-full flex-col justify-between pb-10 pt-4">
            <ul>
              {NAV.map((item, index) => {
                const current = isCurrent(item.id);
                return (
                  <Fragment key={item.id}>
                    <li className="border-b border-rule">
                      <Link
                        href={`/#${item.id}`}
                        aria-current={current ? "location" : undefined}
                        onClick={() => setOpen(false)}
                        className="enter flex items-baseline gap-4 py-4"
                        style={{ "--enter-index": index * 0.4 } as React.CSSProperties}
                      >
                        <span className="label w-6 text-signal">{item.number}</span>
                        <span className="display text-[1.75rem] uppercase">{item.label}</span>
                        {current && <span aria-hidden="true" className="ml-auto size-1.5 self-center bg-signal" />}
                      </Link>
                    </li>
                    {ROUTES_AFTER.get(item.id)?.map((page) => {
                      const here = pathname.startsWith(page.href);
                      return (
                        <li key={page.href} className="border-b border-rule">
                          <Link
                            href={page.href}
                            aria-current={here ? "page" : undefined}
                            onClick={() => setOpen(false)}
                            className="enter flex items-baseline gap-4 py-4"
                            style={{ "--enter-index": (index + 0.5) * 0.4 } as React.CSSProperties}
                          >
                            <span aria-hidden="true" className="label w-6 text-metal-3">
                              /
                            </span>
                            <span className="display text-[1.75rem] uppercase">{page.label}</span>
                            {here && <span aria-hidden="true" className="ml-auto size-1.5 self-center bg-signal" />}
                          </Link>
                        </li>
                      );
                    })}
                  </Fragment>
                );
              })}
            </ul>
            <div className="mt-8 flex flex-col gap-5">
              <a
                href={profile.resume.href}
                target="_blank"
                rel="noopener noreferrer"
                className="label inline-flex min-h-12 items-center justify-center gap-2 bg-bone px-5 text-[0.75rem] text-carbon"
              >
                Résumé
                <Icon name="arrow-up-right" size={14} />
              </a>
              <ul className="flex flex-wrap gap-x-6 gap-y-3">
                {profile.socials.map((social) => (
                  <li key={social.id}>
                    <a
                      href={social.href}
                      target="_blank"
                      rel="noopener noreferrer"
                      className="label inline-flex min-h-11 items-center text-steel"
                    >
                      {social.label}
                    </a>
                  </li>
                ))}
              </ul>
            </div>
          </nav>
        </div>
      )}
    </>
  );
}
