"use client";

import Link from "next/link";
import { useId, useMemo, useState } from "react";

export interface CapabilityUse {
  key: string;
  title: string;
  href?: string;
  note: string;
  /** Where it lives on the site: "Programme", "Project", "Garage", "Experience" — or "" for domain evidence. */
  place: string;
  /** Sort key: the project's position on the site (programmes first). */
  rank?: number;
}

export interface CapabilityDomainView {
  id: string;
  title: string;
  summary: string;
  tools: { name: string; uses: CapabilityUse[] }[];
  evidence: CapabilityUse[];
}

type View = "explore" | "map";

const pad = (n: number) => String(n).padStart(2, "0");
const stagger = (i: number) => ({ "--i": Math.min(i, 12) }) as React.CSSProperties;

/** Distinct projects (not activities) a domain's tools point at. */
function projectsOf(domain: CapabilityDomainView): CapabilityUse[] {
  const out = new Map<string, CapabilityUse>();
  for (const tool of domain.tools) for (const use of tool.uses) if (!use.key.startsWith("src:")) out.set(use.key, use);
  return [...out.values()];
}

function UseRow({ use, index }: { use: CapabilityUse; index: number }) {
  const title = use.href ? (
    <Link href={use.href} className="group/u text-bone transition-colors duration-[var(--dur-fast)] hover:text-champagne-bright">
      {use.title}
      <span
        aria-hidden="true"
        className="ml-2 inline-block text-faint transition-transform duration-[var(--dur-fast)] ease-[var(--ease-snap)] group-hover/u:translate-x-0.5 group-hover/u:text-champagne-bright"
      >
        →
      </span>
    </Link>
  ) : (
    <span className="text-bone">{use.title}</span>
  );
  return (
    <li className="swap-in -mx-3 grid gap-x-6 gap-y-1 rounded-md px-3 py-3.5 transition-colors duration-300 hover:bg-bone/[0.035] sm:grid-cols-[minmax(0,13rem)_minmax(0,1fr)]" style={stagger(index)}>
      <p className="text-[0.9375rem] font-medium leading-snug">
        {title}
        {use.place && <span className="label mt-1 block text-[0.625rem] text-faint">{use.place}</span>}
      </p>
      <p className="text-[0.875rem] leading-relaxed text-steel">{use.note}</p>
    </li>
  );
}

/**
 * Capabilities as something to explore. Pick a domain, then a tool or concept, and every place
 * it was used appears with one line on how. The map view lays every domain against every
 * project, so the shape of the work is visible at a glance; a cell opens the explorer there.
 */
export function CapabilityConsole({ domains }: { domains: CapabilityDomainView[] }) {
  const [view, setView] = useState<View>("explore");
  const [selected, setSelected] = useState(0);
  const [tool, setTool] = useState<string | null>(null);
  const [expanded, setExpanded] = useState(false);
  const baseId = useId();
  const domain = domains[selected];
  const active = domain.tools.find((t) => t.name === tool) ?? null;
  const domainProjects = useMemo(() => {
    const cited = new Set(domain.evidence.map((e) => e.title));
    return projectsOf(domain).filter((p) => !cited.has(p.title));
  }, [domain]);
  const MORE = 8;

  // Map: every project any domain points at, with how many of each domain's tools it uses.
  const matrix = useMemo(() => {
    const rows = new Map<string, { use: CapabilityUse; counts: string[][] }>();
    domains.forEach((d, di) => {
      for (const t of d.tools) {
        for (const use of t.uses) {
          if (use.key.startsWith("src:")) continue;
          const row = rows.get(use.key) ?? { use, counts: domains.map(() => []) };
          row.counts[di].push(t.name);
          rows.set(use.key, row);
        }
      }
    });
    return [...rows.values()].sort((a, b) => (a.use.rank ?? 999) - (b.use.rank ?? 999));
  }, [domains]);

  const choose = (index: number) => {
    setSelected(index);
    setTool(null);
  };
  const pick = (name: string | null) => {
    setTool(name);
    setExpanded(false);
  };
  const SHOWN = 6;
  const visibleUses = active ? (expanded ? active.uses : active.uses.slice(0, SHOWN)) : [];

  return (
    <div>
      {/* View switch — two words, not a control panel. */}
      <div className="flex flex-wrap items-baseline justify-between gap-x-8 gap-y-3">
        <div role="group" aria-label="Capabilities view" className="inline-flex gap-1 rounded-pill border border-bone/[0.07] bg-bone/[0.04] p-1">
          {(["explore", "map"] as const).map((v) => (
            <button
              key={v}
              type="button"
              aria-pressed={view === v}
              onClick={() => setView(v)}
              className={`min-h-10 rounded-pill px-4 text-[0.875rem] font-medium tracking-[-0.01em] transition-[background-color,color,transform] [transition-duration:300ms,300ms,120ms] ease-[var(--ease-soft)] active:scale-[0.98] ${view === v ? "bg-bone/[0.12] text-bone shadow-[inset_0_1px_0_rgb(239_235_228/0.08)]" : "text-steel hover:text-bone"}`}
            >
              {v === "explore" ? "Explore by domain" : "Map of the work"}
            </button>
          ))}
        </div>
        <p className="label hidden text-faint sm:block">
          {view === "explore" ? "Select a domain, then a tool" : `${domains.length} domains × ${matrix.length} projects`}
        </p>
      </div>

      {view === "explore" ? (
        <div className="mt-8 grid gap-y-10 lg:mt-10 lg:grid-cols-12 lg:gap-x-10">
          {/* Domains */}
          <div
            role="tablist"
            aria-label="Capability domains"
            aria-orientation="vertical"
            className="-mx-[var(--gutter)] flex gap-1 overflow-x-auto px-[var(--gutter)] [scrollbar-width:none] lg:col-span-3 lg:mx-0 lg:flex-col lg:gap-0 lg:overflow-visible lg:px-0 [&::-webkit-scrollbar]:hidden"
          >
            {domains.map((d, index) => {
              const on = index === selected;
              const projectCount = projectsOf(d).length;
              return (
                <button
                  key={d.id}
                  type="button"
                  role="tab"
                  id={`${baseId}-tab-${d.id}`}
                  aria-selected={on}
                  aria-controls={`${baseId}-panel`}
                  tabIndex={on ? 0 : -1}
                  onClick={() => choose(index)}
                  onKeyDown={(event) => {
                    const forward = event.key === "ArrowDown" || event.key === "ArrowRight";
                    const back = event.key === "ArrowUp" || event.key === "ArrowLeft";
                    if (!forward && !back) return;
                    event.preventDefault();
                    const next = (index + (forward ? 1 : -1) + domains.length) % domains.length;
                    choose(next);
                    document.getElementById(`${baseId}-tab-${domains[next].id}`)?.focus();
                  }}
                  className="group relative shrink-0 rounded-pill px-4 py-2.5 text-left transition-[color,transform] [transition-duration:480ms,120ms] active:scale-[0.985] lg:rounded-md lg:px-4 lg:py-3"
                >
                  <span
                    aria-hidden="true"
                    className={`absolute inset-0 rounded-[inherit] bg-bone/[0.07] transition-opacity duration-[var(--dur-base)] ease-[var(--ease-soft)] ${on ? "opacity-100" : "opacity-0 group-hover:opacity-40"}`}
                  />
                  <span className="relative flex items-baseline gap-3">
                    <span className={`label hidden transition-colors duration-[var(--dur-base)] lg:inline ${on ? "text-rosso-bright" : "text-faint"}`}>{pad(index + 1)}</span>
                    <span
                      className={`whitespace-nowrap text-[0.9375rem] font-medium transition-colors duration-[var(--dur-base)] lg:text-[1.0625rem] ${
                        on ? "text-bone" : "text-steel group-hover:text-bone"
                      }`}
                    >
                      {d.title}
                    </span>
                  </span>
                  <span className={`label relative mt-1 hidden pl-8 text-[0.625rem] transition-colors duration-[var(--dur-base)] lg:block ${on ? "text-steel" : "text-faint"}`}>
                    {d.tools.length} tools · {projectCount} projects
                  </span>
                </button>
              );
            })}
          </div>

          {/* Tools and concepts of the selected domain */}
          <div role="tabpanel" id={`${baseId}-panel`} aria-labelledby={`${baseId}-tab-${domain.id}`} className="lg:col-span-4 lg:min-h-[18rem]">
            <p key={`s-${domain.id}`} className="swap-in text-[1.0625rem] leading-snug text-bone">
              {domain.summary}
            </p>
            <ul key={domain.id} className="-ml-3 mt-5 flex flex-wrap gap-x-0.5 gap-y-1" aria-label={`${domain.title}: tools and concepts`}>
              {domain.tools.map((t, index) => {
                const on = t.name === tool;
                const count = t.uses.length;
                return (
                  <li key={t.name} className="swap-in" style={stagger(index)}>
                    <button
                      type="button"
                      aria-pressed={on}
                      aria-controls={`${baseId}-detail`}
                      onClick={() => pick(on ? null : t.name)}
                      className={`group/t inline-flex min-h-9 items-baseline gap-1.5 rounded-pill px-3 py-1.5 text-[0.9375rem] transition-[background-color,color,transform] [transition-duration:480ms,480ms,120ms] ease-[var(--ease-out)] active:scale-[0.97] ${
                        on
                          ? "bg-rosso/25 text-bone shadow-[inset_0_0_0_1px_rgb(255_74_85/0.35)]"
                          : count
                            ? "text-bone/85 hover:bg-bone/[0.06] hover:text-bone"
                            : "text-faint hover:bg-bone/[0.04] hover:text-steel"
                      }`}
                    >
                      {t.name}
                      {count > 0 && (
                        <span className={`readout text-[0.6875rem] transition-colors duration-[var(--dur-base)] ${on ? "text-rosso-bright" : "text-faint group-hover/t:text-steel"}`}>
                          {count}
                        </span>
                      )}
                    </button>
                  </li>
                );
              })}
            </ul>
          </div>

          {/* Where it was used */}
          <div id={`${baseId}-detail`} aria-live="polite" className="lg:col-span-5">
            {active ? (
              <div key={`t-${active.name}`}>
                <p className="label swap-in flex items-baseline justify-between gap-4 text-faint">
                  <span>
                    <span className="text-champagne">{active.name}</span>
                    <span aria-hidden="true" className="mx-2 text-metal-3">
                      /
                    </span>
                    {active.uses.length ? `Used in ${active.uses.length} ${active.uses.length === 1 ? "place" : "places"}` : "Not yet in a public project"}
                  </span>
                  <button type="button" onClick={() => pick(null)} className="-mr-3 min-h-9 rounded-pill px-3 text-faint transition-colors duration-[var(--dur-fast)] hover:bg-bone/[0.06] hover:text-bone">
                    Clear
                  </button>
                </p>
                {active.uses.length ? (
                  <>
                    <ul className="mt-2 divide-y divide-rule/70">
                      {visibleUses.map((use, index) => (
                        <UseRow key={use.key} use={use} index={index} />
                      ))}
                    </ul>
                    {active.uses.length > SHOWN && (
                      <button
                        type="button"
                        aria-expanded={expanded}
                        onClick={() => setExpanded((value) => !value)}
                        className="mt-3 min-h-10 rounded-pill border border-bone/[0.1] px-4 text-[0.875rem] font-medium text-steel transition-colors duration-300 hover:border-bone/[0.22] hover:text-bone"
                      >
                        {expanded ? "Show fewer" : `Show ${active.uses.length - SHOWN} more`}
                      </button>
                    )}
                  </>
                ) : (
                  <p className="swap-in mt-4 max-w-[30rem] text-[0.9375rem] leading-relaxed text-steel">
                    Listed on the résumé and part of day-to-day work, but none of the public projects here is built around it yet.
                  </p>
                )}
              </div>
            ) : (
              <div key={`d-${domain.id}`}>
                <p className="label swap-in text-faint">
                  <span className="text-champagne">Evidence</span>
                  <span aria-hidden="true" className="mx-2 text-metal-3">
                    /
                  </span>
                  {domain.title}
                </p>
                <ul className="mt-2 divide-y divide-rule/70">
                  {domain.evidence.map((use, index) => (
                    <UseRow key={use.key} use={use} index={index} />
                  ))}
                </ul>
                {domainProjects.length > 0 && (
                  <div className="swap-in mt-6" style={stagger(domain.evidence.length + 1)}>
                    <p className="label text-faint">Also in this domain</p>
                    <p className="mt-2 text-[0.875rem] leading-relaxed text-steel">
                      {domainProjects.slice(0, MORE).map((project, index) => (
                        <span key={project.key}>
                          {project.href ? (
                            <Link href={project.href} className="text-bone/85 transition-colors duration-[var(--dur-fast)] hover:text-champagne-bright">
                              {project.title}
                            </Link>
                          ) : (
                            project.title
                          )}
                          {index < Math.min(domainProjects.length, MORE) - 1 && <span className="text-metal-3"> · </span>}
                        </span>
                      ))}
                      {domainProjects.length > MORE && <span className="text-faint"> and {domainProjects.length - MORE} more — pick a tool to see them</span>}
                    </p>
                  </div>
                )}
              </div>
            )}
          </div>
        </div>
      ) : (
        <div className="mt-8 lg:mt-10">
          <div className="-mx-[var(--gutter)] overflow-x-auto px-[var(--gutter)] [scrollbar-width:thin]">
            <table className="w-full min-w-[40rem] border-collapse text-left">
              <caption className="sr-only">
                How many tools and concepts from each capability domain each project uses. Select a cell to explore it.
              </caption>
              <thead>
                <tr>
                  <th scope="col" className="label w-[34%] pb-4 font-medium text-faint">
                    Project
                  </th>
                  {domains.map((d) => (
                    <th key={d.id} scope="col" className="label pb-4 text-center font-medium text-faint">
                      {d.title}
                    </th>
                  ))}
                </tr>
              </thead>
              <tbody>
                {matrix.map((row, rowIndex) => (
                  <tr key={row.use.key} className="swap-in group border-t border-rule/70" style={stagger(rowIndex)}>
                    <th scope="row" className="py-2.5 pr-4 font-normal">
                      {row.use.href ? (
                        <Link href={row.use.href} className="text-[0.9375rem] text-bone/90 transition-colors duration-[var(--dur-fast)] hover:text-champagne-bright">
                          {row.use.title}
                        </Link>
                      ) : (
                        <span className="text-[0.9375rem] text-bone/90">{row.use.title}</span>
                      )}
                      <span className="label ml-3 text-[0.625rem] text-faint">{row.use.place}</span>
                    </th>
                    {row.counts.map((names, di) => {
                      const n = names.length;
                      const size = n === 0 ? 0 : n <= 1 ? 6 : n <= 3 ? 10 : 14;
                      return (
                        <td key={domains[di].id} className="py-1 text-center">
                          {n > 0 ? (
                            <button
                              type="button"
                              title={`${row.use.title} · ${domains[di].title}: ${names.join(", ")}`}
                              aria-label={`${row.use.title} uses ${n} from ${domains[di].title}: ${names.join(", ")}`}
                              onClick={() => {
                                setSelected(di);
                                pick(names[0]);
                                setView("explore");
                              }}
                              className="group/c inline-flex size-10 items-center justify-center rounded-pill transition-colors duration-[var(--dur-fast)] hover:bg-bone/[0.06]"
                            >
                              <span
                                aria-hidden="true"
                                className="rounded-pill bg-champagne/80 transition-transform duration-[var(--dur-base)] ease-[var(--ease-out)] group-hover/c:scale-125"
                                style={{ width: size, height: size }}
                              />
                            </button>
                          ) : (
                            <span aria-hidden="true" className="inline-block h-px w-2 bg-metal-2" />
                          )}
                        </td>
                      );
                    })}
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
          <p className="label mt-5 flex flex-wrap items-center gap-x-5 gap-y-2 text-faint">
            <span className="flex items-center gap-2">
              <span aria-hidden="true" className="size-1.5 rounded-pill bg-champagne/80" /> 1 tool
            </span>
            <span className="flex items-center gap-2">
              <span aria-hidden="true" className="size-2.5 rounded-pill bg-champagne/80" /> 2–3
            </span>
            <span className="flex items-center gap-2">
              <span aria-hidden="true" className="size-3.5 rounded-pill bg-champagne/80" /> 4 or more
            </span>
            <span>Select a dot to see which, and how</span>
          </p>
        </div>
      )}
    </div>
  );
}
