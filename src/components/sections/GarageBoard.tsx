"use client";

import { useState } from "react";
import { Icon } from "@/components/ui/Icon";
import type { GarageRepo } from "@/lib/github";

const MONTHS = ["Jan", "Feb", "Mar", "Apr", "May", "Jun", "Jul", "Aug", "Sep", "Oct", "Nov", "Dec"];
/** "2026-10-05" → "Oct 2026". Absolute, so server and client always render the same text. */
const monthOf = (iso: string) => `${MONTHS[Number(iso.slice(5, 7)) - 1] ?? ""} ${iso.slice(0, 4)}`;

const COLUMNS = "lg:grid-cols-[4rem_minmax(0,1fr)_8rem_10.5rem_6rem_1.25rem]";

/**
 * A year of work as a strip of 52 weekly bars — GitHub's own participation statistics, so the
 * column shows how a repository was actually worked on, not just when it was last touched.
 */
function ActivityTrace({ weeks, active }: { weeks: number[]; active: boolean }) {
  const max = Math.max(...weeks);
  const total = weeks.reduce((sum, n) => sum + n, 0);
  // GitHub reports zeros for history it has not indexed (e.g. a repository pushed in one go),
  // so an empty year is shown as "no data" rather than claimed as inactivity.
  if (total === 0) {
    return (
      <span className="label text-faint">
        <span aria-hidden="true">—</span>
        <span className="sr-only">No weekly commit statistics from GitHub</span>
      </span>
    );
  }
  return (
    <span className="flex items-center gap-2.5">
      <svg viewBox="0 0 104 16" className="h-4 w-[6.5rem] shrink-0 overflow-visible" aria-hidden="true">
        <line x1="0" x2="104" y1="15.5" y2="15.5" stroke="var(--color-rule-strong)" strokeWidth="1" />
        {weeks.map((n, i) =>
          n > 0 ? (
            <rect
              key={i}
              x={i * 2}
              y={15 - Math.max(1.5, (n / max) * 14)}
              width="1.5"
              height={Math.max(1.5, (n / max) * 14)}
              fill={active ? "var(--color-signal)" : "var(--color-steel)"}
              opacity={0.45 + 0.55 * (i / 51)}
            />
          ) : null,
        )}
      </svg>
      <span className="readout text-[0.6875rem] text-faint">{total}</span>
      <span className="sr-only">
        {total} commits in the last 52 weeks
      </span>
    </span>
  );
}

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
  const hasActivity = repos.some((repo) => repo.activity);

  return (
    <div>
      {categories.length > 2 && (
        <div
          role="group"
          aria-label="Filter repositories by category"
          className="-mx-[var(--gutter)] flex gap-6 overflow-x-auto px-[var(--gutter)] [scrollbar-width:none] lg:mx-0 lg:px-0 [&::-webkit-scrollbar]:hidden"
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
                className={`label relative flex min-h-11 shrink-0 items-center gap-2 whitespace-nowrap transition-colors duration-[var(--dur-base)] ${
                  active ? "text-bone" : "text-faint hover:text-steel"
                }`}
              >
                {category}
                <span className={`readout text-[0.625rem] ${active ? "text-signal" : "text-faint"}`}>{String(count).padStart(2, "0")}</span>
                <span
                  aria-hidden="true"
                  className={`absolute inset-x-0 bottom-2 h-px origin-left bg-signal transition-transform duration-[420ms] ease-[var(--ease-out)] ${
                    active ? "scale-x-100" : "scale-x-0"
                  }`}
                />
              </button>
            );
          })}
        </div>
      )}

      <div className={`label mt-6 hidden gap-x-6 border-b border-rule pb-3 text-faint lg:grid ${COLUMNS}`}>
        <span>No.</span>
        <span>Repository</span>
        <span>Category</span>
        <span>{hasActivity ? "Commits · 52 weeks" : "Activity"}</span>
        <span>Last push</span>
        <span />
      </div>

      <ul key={filter} className="mt-2 lg:mt-0">
        {shown.map((repo, index) => {
          const number = repos.indexOf(repo) + 1;
          return (
            <li
              key={repo.name}
              className={`swap-in group relative grid grid-cols-[minmax(0,1fr)_auto] gap-x-6 gap-y-2 border-b border-rule/60 py-4 transition-colors duration-[var(--dur-base)] last:border-b-0 lg:items-center lg:px-0 ${COLUMNS}`}
              style={{ "--i": Math.min(index, 12) } as React.CSSProperties}
            >
              {/* Leading edge lights up on hover, like a selected row on a timing screen. */}
              <span
                aria-hidden="true"
                className="absolute inset-y-3 -left-4 w-px origin-top scale-y-0 bg-signal transition-transform duration-[320ms] ease-[var(--ease-out)] group-hover:scale-y-100"
              />

              <span className="readout hidden text-[0.75rem] text-faint transition-colors duration-[var(--dur-fast)] group-hover:text-signal lg:block">
                G.{String(number).padStart(3, "0")}
              </span>

              <div className="min-w-0">
                <h3 className="text-[1rem] font-medium text-bone">
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
                <div className="label mt-2.5 flex flex-wrap items-center gap-x-4 gap-y-2 text-faint lg:hidden">
                  <span>{repo.category}</span>
                  {repo.activity && <ActivityTrace weeks={repo.activity} active={repo.active} />}
                  <span className="flex items-center gap-1.5">
                    <span aria-hidden="true" className={`size-1.5 rounded-full ${repo.active ? "bg-signal" : "border border-metal-3"}`} />
                    {monthOf(repo.pushedAt)}
                  </span>
                </div>
              </div>

              <span className="label hidden text-steel lg:block">{repo.category}</span>
              <span className="hidden lg:block">
                {repo.activity ? (
                  <ActivityTrace weeks={repo.activity} active={repo.active} />
                ) : (
                  <span className="label text-faint">{repo.active ? "Active" : "Resting"}</span>
                )}
              </span>
              <span className="label hidden items-center gap-2 text-steel lg:flex">
                {/* Workshop status light: lit when the repository has been worked on recently. */}
                <span aria-hidden="true" className={`size-1.5 rounded-full ${repo.active ? "bg-signal" : "border border-metal-3"}`} />
                {monthOf(repo.pushedAt)}
                {repo.active && <span className="sr-only"> — recently active</span>}
              </span>

              <Icon
                name="arrow-up-right"
                size={15}
                className="mt-1 text-faint transition-[transform,color] duration-[260ms] ease-[var(--ease-out)] group-hover:-translate-y-0.5 group-hover:translate-x-0.5 group-hover:text-signal lg:mt-0"
              />
            </li>
          );
        })}
      </ul>
    </div>
  );
}
