"use client";

import { useState } from "react";
import { garageNumber, monthOf } from "@/components/garage/format";
import { Icon } from "@/components/ui/Icon";
import { GARAGE_DEFAULT_CATEGORY } from "@/content/garage";
import type { GarageRepo } from "@/lib/github";

const COLUMNS = "lg:grid-cols-[4rem_minmax(0,1fr)_8rem_7.5rem_7rem_1.25rem]";

/**
 * The Garage as a timing sheet: one row per repository, filterable by category.
 * Filters only appear for categories that actually contain repositories.
 */
export function GarageBoard({ repos }: { repos: GarageRepo[] }) {
  const [filter, setFilter] = useState<string>("All");

  const counts = new Map<string, number>();
  for (const repo of repos) counts.set(repo.category, (counts.get(repo.category) ?? 0) + 1);
  // Alphabetical, with the catch-all bucket for uncategorised repositories last.
  const last = GARAGE_DEFAULT_CATEGORY;
  const categories = ["All", ...[...counts.keys()].sort((a, b) => (a === last ? 1 : b === last ? -1 : a.localeCompare(b)))];
  const shown = filter === "All" ? repos : repos.filter((repo) => repo.category === filter);

  return (
    <div>
      {categories.length > 2 && (
        <div
          role="group"
          aria-label="Filter repositories by category"
          className="-mx-[var(--gutter)] flex gap-1.5 overflow-x-auto px-[var(--gutter)] [scrollbar-width:none] lg:mx-0 lg:flex-wrap lg:px-0 [&::-webkit-scrollbar]:hidden"
        >
          {categories.map((category) => {
            const active = category === filter;
            const count = category === "All" ? repos.length : (counts.get(category) ?? 0);
            return (
              <button
                key={category}
                type="button"
                aria-pressed={active}
                onClick={() => setFilter(category)}
                className={`relative flex min-h-10 shrink-0 items-center gap-2 whitespace-nowrap rounded-pill border px-4 text-[0.875rem] font-medium tracking-[-0.01em] transition-[background-color,border-color,color] duration-300 ease-[var(--ease-soft)] ${
                  active
                    ? "border-bone/[0.14] bg-bone/[0.1] text-bone"
                    : "border-bone/[0.06] text-steel hover:border-bone/[0.14] hover:text-bone"
                }`}
              >
                {category}
                <span className={`readout text-[0.6875rem] ${active ? "text-rosso-bright" : "text-faint"}`}>{String(count).padStart(2, "0")}</span>
              </button>
            );
          })}
        </div>
      )}

      <div className={`label mt-8 hidden gap-x-6 border-b border-rule pb-3 text-faint lg:grid ${COLUMNS}`}>
        <span>No.</span>
        <span>Repository</span>
        <span>Category</span>
        <span>Language</span>
        <span>Last push</span>
        <span />
      </div>

      <ul key={filter} className="mt-2 lg:mt-0">
        {shown.map((repo, index) => {
          const number = repos.indexOf(repo) + 1;
          return (
            <li
              key={repo.name}
              className={`swap-in group relative isolate grid grid-cols-[minmax(0,1fr)_auto] gap-x-6 gap-y-2 border-b border-rule/60 py-4 transition-colors duration-[var(--dur-base)] last:border-b-0 lg:items-center lg:px-0 ${COLUMNS}`}
              style={{ "--i": Math.min(index, 12) } as React.CSSProperties}
            >
              {/* The row lifts on hover: a soft rounded fill, like a selected row on a timing screen. */}
              <span
                aria-hidden="true"
                className="absolute -inset-x-3 inset-y-1 -z-10 rounded-md bg-bone/[0.04] opacity-0 transition-opacity duration-300 ease-[var(--ease-soft)] group-hover:opacity-100 lg:-inset-x-4"
              />

              <span className="readout hidden text-[0.75rem] text-faint transition-colors duration-[var(--dur-fast)] group-hover:text-rosso-bright lg:block">
                {garageNumber(number - 1)}
              </span>

              <div className="min-w-0">
                <h3 className="text-[1rem] font-medium text-bone">
                  <a
                    href={repo.url}
                    target="_blank"
                    rel="noopener noreferrer"
                    className="transition-colors duration-[var(--dur-fast)] after:absolute after:inset-0 group-hover:text-champagne-bright"
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
                <div className="label mt-2.5 flex flex-wrap items-center gap-x-4 gap-y-2 text-faint lg:hidden">
                  <span>{repo.category}</span>
                  {repo.language && <span className="text-steel">{repo.language}</span>}
                  <span className="flex items-center gap-1.5">
                    <span aria-hidden="true" className={`size-1.5 rounded-full ${repo.active ? "bg-champagne" : "border border-metal-3"}`} />
                    {monthOf(repo.pushedAt)}
                  </span>
                </div>
              </div>

              <span className="label hidden text-steel lg:block">{repo.category}</span>
              <span className="label hidden text-steel lg:block">
                {repo.language ?? (
                  <>
                    <span aria-hidden="true" className="text-faint">
                      —
                    </span>
                    <span className="sr-only">No primary language reported</span>
                  </>
                )}
              </span>
              <span className="label hidden items-center gap-2 text-steel lg:flex">
                {/* Workshop status light: lit when the repository has been worked on recently. */}
                <span aria-hidden="true" className={`size-1.5 rounded-full ${repo.active ? "bg-champagne" : "border border-metal-3"}`} />
                {monthOf(repo.pushedAt)}
                {repo.active && <span className="sr-only"> — recently active</span>}
              </span>

              <Icon
                name="arrow-up-right"
                size={15}
                className="mt-1 text-faint transition-[transform,color] duration-[260ms] ease-[var(--ease-out)] group-hover:-translate-y-0.5 group-hover:translate-x-0.5 group-hover:text-champagne-bright lg:mt-0"
              />
            </li>
          );
        })}
      </ul>
    </div>
  );
}
