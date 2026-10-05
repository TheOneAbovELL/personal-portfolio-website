"use client";

import Link from "next/link";
import { useId, useState } from "react";
import type { SkillDomain } from "@/content/types";

/**
 * Capabilities as a setup sheet. Selecting a domain (hover, focus or click) shows what it
 * contains and lights up the work that proves it — the same evidence board is shared by every
 * domain, so the relationships between skills and projects become visible.
 */
export function CapabilityConsole({ domains }: { domains: SkillDomain[] }) {
  const [selected, setSelected] = useState(0);
  const baseId = useId();
  const domain = domains[selected];

  // Every distinct piece of evidence across all domains, in first-seen order.
  const board: { source: string; href?: string }[] = [];
  for (const d of domains) {
    for (const e of d.evidence) {
      if (!board.some((item) => item.source === e.source)) board.push({ source: e.source, href: e.href });
    }
  }
  const lit = new Map(domain.evidence.map((e) => [e.source, e.note]));

  return (
    <div className="panel grid grid-cols-12">
      {/* Domains */}
      <div
        role="tablist"
        aria-label="Capability domains"
        aria-orientation="vertical"
        className="col-span-3 border-r border-rule"
      >
        <p className="label weave border-b border-rule px-5 py-3 text-faint">Domain</p>
        {domains.map((d, index) => {
          const active = index === selected;
          return (
            <button
              key={d.id}
              type="button"
              role="tab"
              id={`${baseId}-tab-${d.id}`}
              aria-selected={active}
              aria-controls={`${baseId}-panel`}
              tabIndex={active ? 0 : -1}
              onMouseEnter={() => setSelected(index)}
              onFocus={() => setSelected(index)}
              onClick={() => setSelected(index)}
              onKeyDown={(event) => {
                const delta = event.key === "ArrowDown" ? 1 : event.key === "ArrowUp" ? -1 : 0;
                if (!delta) return;
                event.preventDefault();
                const next = (index + delta + domains.length) % domains.length;
                setSelected(next);
                document.getElementById(`${baseId}-tab-${domains[next].id}`)?.focus();
              }}
              className={`group relative flex w-full items-baseline gap-3 border-b border-rule px-5 py-4 text-left transition-colors duration-[var(--dur-fast)] last:border-b-0 ${
                active ? "bg-graphite-3" : "hover:bg-graphite-2"
              }`}
            >
              <span
                aria-hidden="true"
                className={`absolute inset-y-0 left-0 w-px bg-signal transition-transform duration-[260ms] ease-[var(--ease-snap)] ${
                  active ? "scale-y-100" : "scale-y-0"
                }`}
              />
              <span className={`label transition-colors duration-[var(--dur-fast)] ${active ? "text-signal" : "text-faint"}`}>
                {String(index + 1).padStart(2, "0")}
              </span>
              <span
                className={`display text-[1.1875rem] transition-colors duration-[var(--dur-fast)] ${
                  active ? "text-bone" : "text-steel group-hover:text-bone"
                }`}
              >
                {d.title}
              </span>
            </button>
          );
        })}
      </div>

      {/* Contents of the selected domain */}
      <div
        role="tabpanel"
        id={`${baseId}-panel`}
        aria-labelledby={`${baseId}-tab-${domain.id}`}
        className="col-span-5 border-r border-rule"
      >
        <p className="label weave border-b border-rule px-6 py-3 text-faint">Tools and concepts</p>
        <div key={domain.id} className="p-6">
          <p className="enter text-[1.0625rem] text-bone">{domain.summary}</p>
          <ul className="mt-6 grid grid-cols-2 gap-x-6">
            {domain.items.map((item, index) => (
              <li
                key={item}
                className="enter flex items-center gap-3 border-b border-rule py-2.5 text-[0.9375rem] text-bone"
                style={{ "--enter-index": index * 0.25 } as React.CSSProperties}
              >
                <span aria-hidden="true" className="h-px w-2 shrink-0 bg-data" />
                {item}
              </li>
            ))}
          </ul>
        </div>
      </div>

      {/* Evidence board — shared by all domains; related work lights up */}
      <div className="col-span-4">
        <p className="label weave flex items-center justify-between border-b border-rule px-6 py-3 text-faint">
          Evidence
          <span className="readout text-steel">
            {String(lit.size).padStart(2, "0")} / {String(board.length).padStart(2, "0")}
          </span>
        </p>
        <ul className="px-6 py-3">
          {board.map((item) => {
            const note = lit.get(item.source);
            const on = note !== undefined;
            return (
              <li
                key={item.source}
                className={`grid grid-cols-[0.75rem_1fr] items-baseline gap-x-3 border-b border-rule py-2.5 transition-opacity duration-[var(--dur-base)] last:border-b-0 ${
                  on ? "opacity-100" : "opacity-35"
                }`}
              >
                <span
                  aria-hidden="true"
                  className={`mt-[0.55em] size-1.5 self-start rounded-full transition-colors duration-[var(--dur-fast)] ${
                    on ? "bg-signal shadow-[0_0_10px_var(--color-signal)]" : "bg-metal-3"
                  }`}
                />
                <span>
                  {item.href ? (
                    <Link
                      href={item.href}
                      tabIndex={on ? 0 : -1}
                      className={`text-[0.9375rem] font-medium transition-colors duration-[var(--dur-fast)] hover:text-signal ${
                        on ? "text-bone" : "text-steel"
                      }`}
                    >
                      {item.source}
                    </Link>
                  ) : (
                    <span className="text-[0.9375rem] font-medium">{item.source}</span>
                  )}
                  {on && <span className="enter mt-0.5 block text-[0.8125rem] leading-snug text-steel">{note}</span>}
                </span>
              </li>
            );
          })}
        </ul>
      </div>
    </div>
  );
}
