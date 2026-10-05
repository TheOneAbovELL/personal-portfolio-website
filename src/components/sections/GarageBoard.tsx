"use client";

import { useState } from "react";
import { Icon } from "@/components/ui/Icon";
import type { GarageRepo } from "@/lib/github";

const MONTHS = ["Jan", "Feb", "Mar", "Apr", "May", "Jun", "Jul", "Aug", "Sep", "Oct", "Nov", "Dec"];
/** "2026-10-05" → "Oct 2026". Absolute, so server and client always render the same text. */
const monthOf = (iso: string) => `${MONTHS[Number(iso.slice(5, 7)) - 1] ?? ""} ${iso.slice(0, 4)}`;

/**
 * The Garage as a timing sheet: one row per repository, filterable by category.
 * Filters only appear for categories that actually contain repositories.
 */
export function GarageBoard({ repos }: { repos: GarageRepo[] }) {
  const [filter, setFilter] = useState<string>("All");

  const counts = new Map<string, number>();
  for (const repo of repos) counts.set(repo.category, (counts.get(repo.category) ?? 0) + 1);
  const categories = ["All", ...[...counts.keys()].sort((a, b) => (a === "Other" ? 1 : b === "Other" ? -1 : a.localeCompare(b)))];
  const shown = filter === "All" ? repos : repos.filter((repo) => repo.category === filter);

  return (
    <div className="panel">
      {categories.length > 2 && (
        <div role="group" aria-label="Filter repositories by category" className="weave flex gap-px overflow-x-auto border-b border-rule [scrollbar-width:none] [&::-webkit-scrollbar]:hidden">
          {categories.map((category) => {
            const active = category === filter;
            const count = category === "All" ? repos.length : (counts.get(category) ?? 0);
            return (
              <button
                key={category}
                type="button"
                aria-pressed={active}
                onClick={() => setFilter(category)}
                className={`label relative flex min-h-11 shrink-0 items-center gap-2 whitespace-nowrap px-4 transition-colors duration-[var(--dur-fast)] ${
                  active ? "bg-carbon text-signal" : "text-steel hover:text-bone"
                }`}
              >
                {category}
                <span className={`readout text-[0.625rem] ${active ? "text-signal" : "text-faint"}`}>
                  {String(count).padStart(2, "0")}
                </span>
                <span
                  aria-hidden="true"
                  className={`absolute inset-x-0 bottom-0 h-px origin-left bg-signal transition-transform duration-[260ms] ease-[var(--ease-snap)] ${
                    active ? "scale-x-100" : "scale-x-0"
                  }`}
                />
              </button>
            );
          })}
        </div>
      )}

      <div className="label hidden grid-cols-[4.5rem_minmax(0,1fr)_8.5rem_7rem_6rem_1.5rem] gap-x-6 border-b border-rule px-5 py-2.5 text-faint lg:grid">
        <span>No.</span>
        <span>Repository</span>
        <span>Category</span>
        <span>Language</span>
        <span>Updated</span>
        <span />
      </div>

      <ul>
        {shown.map((repo) => {
          const number = repos.indexOf(repo) + 1;
          return (
            <li
              key={repo.name}
              data-reveal="snap"
              style={{ "--reveal-index": Math.min(shown.indexOf(repo), 10) } as React.CSSProperties}
              className="group relative grid grid-cols-[minmax(0,1fr)_auto] gap-x-6 gap-y-2 border-b border-rule px-5 py-4 transition-colors duration-[var(--dur-fast)] last:border-b-0 hover:bg-graphite-2 lg:grid-cols-[4.5rem_minmax(0,1fr)_8.5rem_7rem_6rem_1.5rem] lg:items-baseline"
            >
              {/* Leading edge lights up on hover, like a selected row on a timing screen. */}
              <span
                aria-hidden="true"
                className="absolute inset-y-0 left-0 w-px origin-top scale-y-0 bg-signal transition-transform duration-[220ms] ease-[var(--ease-snap)] group-hover:scale-y-100"
              />

              <span className="readout hidden text-[0.75rem] text-faint transition-colors duration-[var(--dur-fast)] group-hover:text-signal lg:block">
                G.{String(number).padStart(3, "0")}
              </span>

              <div className="min-w-0">
                <h3 className="text-[1.0625rem] font-medium text-bone">
                  <a
                    href={repo.url}
                    target="_blank"
                    rel="noopener noreferrer"
                    className="transition-colors duration-[var(--dur-fast)] after:absolute after:inset-0 group-hover:text-signal"
                  >
                    {repo.title}
                  </a>
                  {repo.archived && <span className="label ml-3 text-warn">Archived</span>}
                  {repo.homepage && (
                    <a
                      href={repo.homepage}
                      target="_blank"
                      rel="noopener noreferrer"
                      aria-label={`${repo.title} live demo`}
                      className="label relative z-10 ml-3 inline-flex items-center gap-1.5 align-middle text-data transition-colors duration-[var(--dur-fast)] hover:text-bone"
                    >
                      <span aria-hidden="true" className="size-1 rounded-full bg-data" />
                      Live
                    </a>
                  )}
                </h3>
                {repo.description && <p className="mt-1 max-w-[44rem] text-[0.875rem] leading-snug text-steel">{repo.description}</p>}
                <p className="label mt-2 flex flex-wrap gap-x-4 gap-y-1 text-faint lg:hidden">
                  <span>{repo.category}</span>
                  {repo.language && <span className="text-data">{repo.language}</span>}
                  <span className="flex items-center gap-1.5">
                    <span aria-hidden="true" className={`size-1.5 ${repo.active ? "bg-signal" : "border border-metal-3"}`} />
                    {monthOf(repo.pushedAt)}
                  </span>
                </p>
              </div>

              <span className="label hidden text-steel lg:block">{repo.category}</span>
              <span className="label hidden items-center gap-2 text-steel lg:flex">
                {repo.language && (
                  <>
                    <span aria-hidden="true" className="size-1.5 bg-data" />
                    {repo.language}
                  </>
                )}
              </span>
              <span className="label hidden items-center gap-2 text-steel lg:flex">
                {/* Workshop status light: lit when the repository has been worked on recently. */}
                <span aria-hidden="true" className={`size-1.5 ${repo.active ? "bg-signal" : "border border-metal-3"}`} />
                {monthOf(repo.pushedAt)}
                {repo.active && <span className="sr-only"> — recently active</span>}
              </span>

              <Icon
                name="arrow-up-right"
                size={15}
                className="mt-1 text-faint transition-[transform,color] duration-[220ms] ease-[var(--ease-snap)] group-hover:-translate-y-0.5 group-hover:translate-x-0.5 group-hover:text-signal lg:mt-0"
              />
            </li>
          );
        })}
      </ul>
    </div>
  );
}
