"use client";

import Link from "next/link";
import { useCallback, useEffect, useId, useMemo, useRef, useState } from "react";
import type { CSSProperties, KeyboardEvent as ReactKeyboardEvent, MouseEvent as ReactMouseEvent, RefObject } from "react";
import { Icon } from "@/components/ui/Icon";
import { prefersReducedMotion } from "@/lib/motion";
import { sendToAsk, type NavigatorRequest } from "./events";
import type { NavData, NavPage, NavProgramme, NavSector } from "./types";
import "./navigator.css";

/** How long the overlay takes to leave. Matches `.nav-overlay[data-state="closing"]`. */
const CLOSE_MS = 220;
/** The colour the room is lit with when nothing is previewed: racing yellow, the site's signal. */
const SIGNAL = "242 194 48";

type Preview =
  | { kind: "programme"; item: NavProgramme }
  | { kind: "sector"; item: NavSector }
  | { kind: "page"; item: NavPage };

interface NavigatorProps {
  data: NavData;
  /** Null while closed. */
  request: NavigatorRequest | null;
  onClose: () => void;
  onOpen: (request?: NavigatorRequest) => void;
  /** Where focus goes when the navigator closes, if focus was not somewhere else before. */
  returnFocus: RefObject<HTMLElement | null>;
  /** The homepage sector under the reading line, or null off the homepage. */
  zone: string | null;
  pathname: string;
}

const fold = (text: string) =>
  text
    .toLowerCase()
    .normalize("NFKD")
    .replace(/[̀-ͯ]/g, "")
    .replace(/[^a-z0-9]+/g, " ")
    .trim();

/** Every word of the query starts a word somewhere in the item. */
function matches(query: string, ...fields: (string | null | undefined)[]): boolean {
  const words = fold(query).split(" ").filter(Boolean);
  if (words.length === 0) return true;
  const haystack = ` ${fold(fields.filter(Boolean).join(" "))}`;
  return words.every((word) => haystack.includes(` ${word}`));
}

/** "/#ask" → { path: "/", hash: "ask" }. */
function splitHref(href: string): { path: string; hash: string | null } {
  const [path, hash] = href.split("#");
  return { path: path || "/", hash: hash ?? null };
}

function scrollToId(id: string): void {
  const target = document.getElementById(id);
  if (!target) return;
  target.scrollIntoView({ behavior: prefersReducedMotion() ? "auto" : "smooth", block: "start" });
}

/** Lock the page behind the overlay, keeping the scrollbar's width so nothing shifts. */
function lockScroll(): () => void {
  const root = document.documentElement;
  const gap = window.innerWidth - root.clientWidth;
  const previous = { overflow: root.style.overflow, paddingRight: document.body.style.paddingRight };
  root.style.overflow = "hidden";
  if (gap > 0) document.body.style.paddingRight = `${gap}px`;
  let released = false;
  return () => {
    if (released) return;
    released = true;
    root.style.overflow = previous.overflow;
    document.body.style.paddingRight = previous.paddingRight;
  };
}

const FOCUSABLE = 'a[href], button:not([disabled]), input:not([disabled]), [tabindex]:not([tabindex="-1"])';

/**
 * The navigator: the whole site on one sheet. Sectors of the homepage lap with a live "you are
 * here", the pages beside them, and every programme in sequence with its colour — hovering or
 * focusing one previews it, and the room takes on its light. Typing filters everything; a
 * question nobody has a page for goes to Ask Omjee.
 *
 * A modal dialog: focus is trapped, the page behind is locked, Esc closes, arrow keys move
 * through the list (left and right between columns), and focus returns where it came from.
 */
export function Navigator({ data, request, onClose, onOpen, returnFocus, zone, pathname }: NavigatorProps) {
  // The panel mounts fresh on every open, so its filter and preview start from the request.
  return request ? (
    <NavigatorPanel
      data={data}
      request={request}
      onClose={onClose}
      returnFocus={returnFocus}
      zone={zone}
      pathname={pathname}
    />
  ) : (
    <DevOpen onOpen={onOpen} />
  );
}

/** Development stills: `?nav=open` (optionally `&q=<filter>` and `&preview=<slug>`) opens the navigator on load. */
function DevOpen({ onOpen }: { onOpen: (request?: NavigatorRequest) => void }) {
  useEffect(() => {
    if (process.env.NODE_ENV === "production") return;
    const params = new URLSearchParams(window.location.search);
    if (params.get("nav") !== "open") return;
    const frame = window.setTimeout(() =>
      onOpen({ query: params.get("q") ?? undefined, preview: params.get("preview") ?? undefined, still: true }),
    );
    return () => window.clearTimeout(frame);
    // Once, on load: closing the navigator afterwards must not reopen it.
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);
  return null;
}

function NavigatorPanel({ data, request, onClose, returnFocus, zone, pathname }: Omit<NavigatorProps, "onOpen"> & { request: NavigatorRequest }) {
  const [query, setQuery] = useState(request.query ?? "");
  const [closing, setClosing] = useState(false);
  const [preview, setPreview] = useState<Preview | null>(() => {
    const item = data.programmes.find((programme) => programme.slug === request.preview);
    return item ? { kind: "programme", item } : null;
  });

  const rootRef = useRef<HTMLDivElement>(null);
  const inputRef = useRef<HTMLInputElement>(null);
  const releaseRef = useRef<(() => void) | null>(null);
  const timerRef = useRef<number | null>(null);
  const baseId = useId();
  const onHomepage = pathname === "/";

  // Open: lock the page, take focus, remember where focus was. Close: give it all back.
  useEffect(() => {
    const before = document.activeElement instanceof HTMLElement ? document.activeElement : null;
    const fallback = returnFocus.current;
    releaseRef.current = lockScroll();
    // A touch keyboard would cover half the sheet: phones get the dialog focused, not the field.
    if (window.matchMedia("(pointer: fine)").matches) inputRef.current?.focus({ preventScroll: true });
    else rootRef.current?.focus({ preventScroll: true });
    return () => {
      releaseRef.current?.();
      if (timerRef.current !== null) window.clearTimeout(timerRef.current);
      const target = before && before !== document.body && before.isConnected ? before : fallback;
      target?.focus({ preventScroll: true });
    };
  }, [returnFocus]);

  /** Fade out, then unmount. `then` runs at once, with the page already unlocked beneath. */
  const close = useCallback(
    (then?: () => void) => {
      if (timerRef.current !== null) return;
      releaseRef.current?.();
      setClosing(true);
      then?.();
      timerRef.current = window.setTimeout(onClose, prefersReducedMotion() ? 0 : CLOSE_MS);
    },
    [onClose],
  );

  /* ---------------------------------------------------------------- filtering */

  const filtered = useMemo(() => {
    const sectors = data.sectors.filter((sector) => matches(query, sector.number, sector.label, sector.note));
    const pages = data.pages.filter((page) => matches(query, page.label, page.note, page.href.replace(/[/#]/g, " ")));
    const programmes = data.programmes.filter((programme) =>
      matches(query, programme.number, programme.title, programme.discipline, programme.tagline, programme.status),
    );
    return { sectors, pages, programmes };
  }, [data, query]);

  const trimmed = query.trim();
  const total = filtered.sectors.length + filtered.pages.length + filtered.programmes.length;
  const offerAsk = trimmed.length >= 2;

  /* ------------------------------------------------------------- activation */

  const onNavigate = (event: ReactMouseEvent<HTMLAnchorElement>, href: string) => {
    if (event.metaKey || event.ctrlKey || event.shiftKey || event.button !== 0) return;
    const { path, hash } = splitHref(href);
    if (hash && path === pathname) {
      // Same page: scroll there as the sheet lifts, rather than jumping behind it.
      event.preventDefault();
      close(() => {
        window.history.replaceState(window.history.state, "", href);
        scrollToId(hash);
      });
      return;
    }
    close();
  };

  const onAsk = (event: ReactMouseEvent<HTMLAnchorElement>) => {
    if (!trimmed) return;
    if (onHomepage) {
      event.preventDefault();
      close(() => {
        scrollToId("ask");
        sendToAsk(trimmed, true);
      });
      return;
    }
    // Another page: the question waits in the session and the console takes it on arrival.
    sendToAsk(trimmed, false);
    close();
  };

  /* --------------------------------------------------------------- keyboard */

  const items = () => [...(rootRef.current?.querySelectorAll<HTMLElement>("[data-nav-item]") ?? [])];

  const onKeyDown = (event: ReactKeyboardEvent<HTMLDivElement>) => {
    const active = document.activeElement as HTMLElement | null;
    const list = items();
    const index = active ? list.indexOf(active) : -1;
    const inInput = active === inputRef.current;

    switch (event.key) {
      case "Escape":
        event.preventDefault();
        close();
        return;
      case "Tab": {
        const focusables = [...(rootRef.current?.querySelectorAll<HTMLElement>(FOCUSABLE) ?? [])];
        const first = focusables[0];
        const last = focusables[focusables.length - 1];
        if (!first || !last) return;
        if (event.shiftKey && (active === first || active === rootRef.current)) {
          event.preventDefault();
          last.focus();
        } else if (!event.shiftKey && active === last) {
          event.preventDefault();
          first.focus();
        }
        return;
      }
      case "ArrowDown":
      case "ArrowUp": {
        if (list.length === 0) return;
        event.preventDefault();
        const down = event.key === "ArrowDown";
        if (inInput || index === -1) {
          (down ? list[0] : list[list.length - 1]).focus();
        } else if (!down && index === 0) {
          inputRef.current?.focus();
        } else {
          list[(index + (down ? 1 : -1) + list.length) % list.length].focus();
        }
        return;
      }
      case "ArrowLeft":
      case "ArrowRight": {
        if (inInput || index === -1 || !active) return;
        const column = Number(active.dataset.col);
        const columns = [...new Set(list.map((item) => Number(item.dataset.col)))].sort((a, b) => a - b);
        const next = columns[columns.indexOf(column) + (event.key === "ArrowRight" ? 1 : -1)];
        if (next === undefined) return;
        event.preventDefault();
        // The nearest item at the same height in the neighbouring column.
        const top = active.getBoundingClientRect().top;
        const candidates = list.filter((item) => Number(item.dataset.col) === next);
        const nearest = candidates.reduce((best, item) =>
          Math.abs(item.getBoundingClientRect().top - top) < Math.abs(best.getBoundingClientRect().top - top) ? item : best,
        );
        nearest.focus();
        return;
      }
      case "Home":
      case "End":
        if (inInput || list.length === 0) return;
        event.preventDefault();
        (event.key === "Home" ? list[0] : list[list.length - 1]).focus();
        return;
      default:
        // Typing anywhere on the sheet goes to the filter.
        if (!inInput && event.key.length === 1 && !event.metaKey && !event.ctrlKey && !event.altKey && event.key !== " ") {
          inputRef.current?.focus();
        }
    }
  };

  /* ---------------------------------------------------------------- render */

  const here = (sector: NavSector) => zone === sector.id;
  const pageHere = (page: NavPage) => pathname === page.href;
  const programmeHere = (programme: NavProgramme) => pathname === `/work/${programme.slug}`;

  // While filtering, the first programme left standing is previewed until the visitor points elsewhere.
  const shown: Preview | null =
    preview ?? (trimmed && filtered.programmes[0] ? { kind: "programme", item: filtered.programmes[0] } : null);
  const glow = shown?.kind === "programme" ? shown.item.primary : SIGNAL;
  const homeProgrammes = filtered.programmes.filter((programme) => programme.group === "home");
  const projectProgrammes = filtered.programmes.filter((programme) => programme.group === "projects");
  const allHome = data.programmes.filter((programme) => programme.group === "home");
  const allProjects = data.programmes.filter((programme) => programme.group === "projects");
  const range = (list: NavProgramme[]) => (list.length ? `${list[0].number}–${list[list.length - 1].number}` : "");

  let order = 0;
  const rise = () => ({ "--i": Math.min(order++, 24) }) as CSSProperties;

  return (
    <div
      ref={rootRef}
      id="navigator"
      role="dialog"
      aria-modal="true"
      aria-label="Site navigator"
      tabIndex={-1}
      data-state={closing ? "closing" : "open"}
      data-still={request.still ? "" : undefined}
      data-lenis-prevent=""
      className="nav-overlay"
      style={{ "--glow": glow } as CSSProperties}
      onKeyDown={onKeyDown}
    >
      <div aria-hidden="true" className="nav-glow" />

      <div className="shell nav-frame">
        <div className="nav-top">
          <Link href="/" className="label nav-wordmark" onClick={(event) => onNavigate(event, "/")}>
            <span aria-hidden="true" className="nav-wordmark-tick" />
            {data.name}
          </Link>
          <button type="button" className="label nav-close" onClick={() => close()}>
            Close
            <kbd aria-hidden="true" className="nav-kbd">
              Esc
            </kbd>
          </button>
        </div>

        <div className="nav-search nav-rise" style={rise()}>
          <label htmlFor={`${baseId}-filter`} className="label nav-search-label">
            Go to
          </label>
          <input
            ref={inputRef}
            id={`${baseId}-filter`}
            type="text"
            value={query}
            onChange={(event) => setQuery(event.target.value)}
            onKeyDown={(event) => {
              if (event.key !== "Enter") return;
              event.preventDefault();
              const first = items()[0];
              first?.click();
            }}
            autoComplete="off"
            spellCheck="false"
            enterKeyHint="go"
            placeholder="A section, a programme, or a question"
            aria-describedby={`${baseId}-hint`}
            aria-controls={`${baseId}-results`}
            className="nav-search-input"
          />
          <p id={`${baseId}-hint`} className="label nav-search-hint">
            <span className="nav-hint-keys" aria-hidden="true">
              <kbd className="nav-kbd">↑</kbd>
              <kbd className="nav-kbd">↓</kbd>
            </span>
            <span className="sr-only">Arrow keys move through the list. Enter opens the first match.</span>
            <span aria-hidden="true">
              <kbd className="nav-kbd">↵</kbd> open
            </span>
          </p>
          <span aria-hidden="true" className="nav-search-rule" />
        </div>

        <div id={`${baseId}-results`} className="nav-grid">
          {/* Column 1 — the lap and the pages beside it. */}
          <nav aria-label="Sections and pages" className="nav-col">
            {filtered.sectors.length > 0 && (
              <section>
                <h2 className="label nav-heading nav-rise" style={rise()}>
                  Sectors <span className="nav-count">{String(filtered.sectors.length).padStart(2, "0")}</span>
                </h2>
                <ul className="nav-sectors">
                  {filtered.sectors.map((sector) => {
                    const current = here(sector);
                    return (
                      <li key={sector.id} className="nav-rise" style={rise()}>
                        <Link
                          href={sector.href}
                          data-nav-item=""
                          data-col="0"
                          aria-current={current ? "location" : undefined}
                          className="nav-sector"
                          onClick={(event) => onNavigate(event, sector.href)}
                          onMouseEnter={() => setPreview({ kind: "sector", item: sector })}
                          onFocus={() => setPreview({ kind: "sector", item: sector })}
                        >
                          <span className="nav-sector-number readout">{sector.number}</span>
                          <span className="nav-sector-label display">{sector.label}</span>
                          {current && (
                            <span className="label nav-here">
                              <i aria-hidden="true" />
                              You are here
                            </span>
                          )}
                        </Link>
                      </li>
                    );
                  })}
                </ul>
              </section>
            )}

            {filtered.pages.length > 0 && (
              <section className="nav-pages">
                <h2 className="label nav-heading nav-rise" style={rise()}>
                  Pages <span className="nav-count">{String(filtered.pages.length).padStart(2, "0")}</span>
                </h2>
                <ul>
                  {filtered.pages.map((page) => {
                    const current = pageHere(page);
                    return (
                      <li key={page.href} className="nav-rise" style={rise()}>
                        <Link
                          href={page.href}
                          data-nav-item=""
                          data-col="0"
                          aria-current={current ? "page" : undefined}
                          className="nav-page"
                          onClick={(event) => onNavigate(event, page.href)}
                          onMouseEnter={() => setPreview({ kind: "page", item: page })}
                          onFocus={() => setPreview({ kind: "page", item: page })}
                        >
                          <span aria-hidden="true" className="nav-page-mark">
                            /
                          </span>
                          <span className="nav-page-label">{page.label}</span>
                          <span className="nav-page-note">{page.note}</span>
                          {current && <i aria-hidden="true" className="nav-dot" />}
                        </Link>
                      </li>
                    );
                  })}
                </ul>
              </section>
            )}
          </nav>

          {/* Column 2 — every programme, in sequence, each in its own colour. */}
          <nav aria-label="Programmes" className="nav-col">
            {[
              { key: "home", title: "Homepage", list: homeProgrammes, all: allHome },
              { key: "projects", title: "Projects", list: projectProgrammes, all: allProjects },
            ].map(
              (group) =>
                group.list.length > 0 && (
                  <section key={group.key} className="nav-group">
                    <h2 className="label nav-heading nav-rise" style={rise()}>
                      {group.title} <span className="nav-count">{range(group.all)}</span>
                    </h2>
                    <ul>
                      {group.list.map((programme) => {
                        const current = programmeHere(programme);
                        const previewed = shown?.kind === "programme" && shown.item.slug === programme.slug;
                        return (
                          <li key={programme.slug} className="nav-rise" style={rise()}>
                            <Link
                              href={programme.href}
                              data-nav-item=""
                              data-col="1"
                              data-previewed={previewed ? "" : undefined}
                              aria-current={current ? "page" : undefined}
                              aria-describedby={`${baseId}-p-${programme.slug}`}
                              className="nav-programme"
                              style={{ "--prog": programme.primary, "--prog-2": programme.secondary } as CSSProperties}
                              onClick={(event) => onNavigate(event, programme.href)}
                              onMouseEnter={() => setPreview({ kind: "programme", item: programme })}
                              onFocus={() => setPreview({ kind: "programme", item: programme })}
                            >
                              <span aria-hidden="true" className="nav-programme-bar" />
                              <span className="nav-programme-number readout">{programme.number}</span>
                              <span className="nav-programme-title">{programme.title}</span>
                              <span id={`${baseId}-p-${programme.slug}`} className="label nav-programme-discipline">
                                {programme.discipline ?? programme.status}
                              </span>
                            </Link>
                          </li>
                        );
                      })}
                    </ul>
                  </section>
                ),
            )}

            {offerAsk && (
              <section className="nav-group">
                <h2 className="label nav-heading">Ask Omjee</h2>
                <ul>
                  <li>
                    <Link href="/#ask" data-nav-item="" data-col="1" className="nav-ask" onClick={onAsk}>
                      <span aria-hidden="true" className="readout nav-ask-prompt">
                        ›
                      </span>
                      <span className="nav-ask-text">
                        {total === 0 ? "Nothing here by that name. Ask the guide: " : "Ask the guide: "}
                        <q>{trimmed}</q>
                      </span>
                      <Icon name="arrow-right" size={14} className="nav-ask-arrow" />
                    </Link>
                  </li>
                </ul>
              </section>
            )}
          </nav>

          {/* Column 3 — what the highlighted item is, before going there. */}
          <aside aria-hidden="true" className="nav-preview nav-rise" style={rise()}>
            <PreviewPane preview={shown} data={data} zone={zone} />
          </aside>
        </div>

        <div className="nav-foot nav-rise" style={rise()}>
          <a href={`mailto:${data.email}`} className="nav-foot-email">
            {data.email}
          </a>
          <ul className="nav-socials">
            {data.socials.map((social) => (
              <li key={social.id}>
                <a href={social.href} target="_blank" rel="noopener noreferrer" className="label nav-social">
                  {social.label}
                </a>
              </li>
            ))}
            <li>
              <a href={data.resumeHref} target="_blank" rel="noopener noreferrer" className="label nav-social nav-resume">
                Résumé
                <Icon name="arrow-up-right" size={12} />
              </a>
            </li>
          </ul>
        </div>
      </div>
    </div>
  );
}

function PreviewPane({ preview, data, zone }: { preview: Preview | null; data: NavData; zone: string | null }) {
  if (preview?.kind === "programme") {
    const { item } = preview;
    const last = data.programmes[data.programmes.length - 1]?.number;
    return (
      <div key={item.slug} className="nav-preview-card" style={{ "--prog": item.primary, "--prog-2": item.secondary } as CSSProperties}>
        <span className="nav-preview-rule" />
        <p className="label nav-preview-kicker">
          Programme {item.number}
          <span className="text-faint"> / {last}</span>
        </p>
        <p className="display nav-preview-numeral">{item.number}</p>
        <p className="display nav-preview-title">{item.title}</p>
        {item.discipline && <p className="label nav-preview-meta">{item.discipline}</p>}
        <p className="nav-preview-text">{item.tagline}</p>
        <p className="label nav-preview-status">
          <i />
          {item.status}
        </p>
      </div>
    );
  }

  if (preview?.kind === "sector" || preview?.kind === "page") {
    const isSector = preview.kind === "sector";
    const label = preview.item.label;
    return (
      <div key={`${preview.kind}-${label}`} className="nav-preview-card">
        <span className="nav-preview-rule" />
        <p className="label nav-preview-kicker">{isSector ? `Sector ${(preview.item as NavSector).number}` : "Page"}</p>
        <p className="display nav-preview-numeral">{isSector ? (preview.item as NavSector).number : "/"}</p>
        <p className="display nav-preview-title">{label}</p>
        <p className="nav-preview-text">{preview.item.note}</p>
        {isSector && zone === (preview.item as NavSector).id && (
          <p className="label nav-preview-status">
            <i />
            You are here
          </p>
        )}
      </div>
    );
  }

  const current = data.sectors.find((sector) => sector.id === zone);
  return (
    <div className="nav-preview-card">
      <span className="nav-preview-rule" />
      <p className="label nav-preview-kicker">{current ? "You are here" : "Index"}</p>
      <p className="display nav-preview-numeral">{current ? current.number : String(data.programmes.length).padStart(2, "0")}</p>
      <p className="display nav-preview-title">{current ? current.label : "Programmes"}</p>
      {current && <p className="nav-preview-text">{current.note}.</p>}
      <p className="nav-preview-text">
        {data.sectors.length} sectors, {data.pages.length} pages and {data.programmes.length} programmes. Point at one to
        see what it is; type to narrow the list.
      </p>
    </div>
  );
}
