import { garageNumber, monthOf } from "@/components/garage/format";
import { Icon } from "@/components/ui/Icon";
import { GARAGE_CATEGORIES, type GarageCategory } from "@/content/garage";
import type { GarageRepo } from "@/lib/github";
import { reveal } from "@/lib/reveal";

export interface ShelfGroup {
  category: GarageCategory;
  repos: { repo: GarageRepo; number: string }[];
}

/**
 * Everything in the Garage that is not already a programme, grouped in `GARAGE_CATEGORIES`
 * order. Each repository keeps its Garage number (its position in the full list), so the same
 * project reads the same here and on the homepage.
 */
export function shelfGroups(garage: GarageRepo[], exclude: Set<string>): ShelfGroup[] {
  return GARAGE_CATEGORIES.map((category) => ({
    category,
    repos: garage
      .map((repo, index) => ({ repo, number: garageNumber(index) }))
      .filter(({ repo }) => repo.category === category && !exclude.has(repo.name.toLowerCase())),
  })).filter((group) => group.repos.length > 0);
}

function RepoCard({ repo, number, index }: { repo: GarageRepo; number: string; index: number }) {
  return (
    <li
      className="surface group relative isolate flex flex-col rounded-lg p-5 transition-[transform,border-color,background-color] duration-300 ease-[var(--ease-soft)] hover:-translate-y-0.5 hover:border-bone/[0.14] hover:bg-bone/[0.05] motion-reduce:transition-none motion-reduce:hover:translate-y-0 sm:p-6"
      {...reveal("rise", Math.min(index, 8))}
    >
      <div className="label flex items-center justify-between gap-4 text-faint">
        <span className="readout text-[0.6875rem] transition-colors duration-[var(--dur-fast)] group-hover:text-rosso-bright">
          {number}
        </span>
        <span className="flex items-center gap-1.5">
          {/* Workshop status light: lit when the repository has been worked on in the last 90 days. */}
          <span aria-hidden="true" className={`size-1.5 rounded-full ${repo.active ? "bg-champagne" : "border border-metal-3"}`} />
          {monthOf(repo.pushedAt)}
          {repo.active && <span className="sr-only"> — recently active</span>}
        </span>
      </div>

      <h4 className="mt-4 text-[1.0625rem] font-medium leading-snug tracking-[-0.01em] text-bone">
        <a
          href={repo.url}
          target="_blank"
          rel="noopener noreferrer"
          className="transition-colors duration-[var(--dur-fast)] after:absolute after:inset-0 after:rounded-lg group-hover:text-champagne-bright"
        >
          {repo.title}
        </a>
        {repo.archived && <span className="label ml-3 align-middle text-warn">Archived</span>}
      </h4>
      {repo.description && <p className="mt-2 text-[0.875rem] leading-snug text-steel">{repo.description}</p>}

      <div className="label mt-auto flex flex-wrap items-center gap-x-4 gap-y-2 pt-5 text-faint">
        {repo.language && <span className="text-steel">{repo.language}</span>}
        <span className="ml-auto flex items-center gap-4">
          {repo.homepage && (
            <a
              href={repo.homepage}
              target="_blank"
              rel="noopener noreferrer"
              aria-label={`${repo.title} live demo`}
              className="relative z-10 inline-flex min-h-8 items-center gap-1.5 text-data transition-colors duration-[var(--dur-fast)] hover:text-bone"
            >
              <span aria-hidden="true" className="size-1 rounded-full bg-data" />
              Live
            </a>
          )}
          <span className="inline-flex items-center gap-1.5 transition-colors duration-[var(--dur-fast)] group-hover:text-champagne-bright">
            GitHub
            <Icon
              name="arrow-up-right"
              size={14}
              className="transition-transform duration-[260ms] ease-[var(--ease-out)] group-hover:-translate-y-0.5 group-hover:translate-x-0.5"
            />
          </span>
        </span>
      </div>
    </li>
  );
}

/**
 * The "From GitHub" shelf on /projects: rounded cards, three across on desktop and one on a
 * phone, grouped by category. Driven entirely by the live repository list, so a repository
 * pushed tomorrow appears here on the next revalidation without a content change.
 */
export function GitHubShelf({ groups }: { groups: ShelfGroup[] }) {
  return (
    <div className="space-y-[clamp(2.5rem,5vw,3.5rem)]">
      {groups.map((group) => (
        <section key={group.category} aria-labelledby={`shelf-${group.category.replace(/[^a-z]+/gi, "-").toLowerCase()}`}>
          <div className="flex items-baseline justify-between gap-6 border-b border-rule pb-3">
            <h3
              id={`shelf-${group.category.replace(/[^a-z]+/gi, "-").toLowerCase()}`}
              className="label text-bone"
              data-reveal="snap"
            >
              {group.category}
            </h3>
            <p className="label text-faint" data-reveal="snap" style={{ "--reveal-index": 1 } as React.CSSProperties}>
              {String(group.repos.length).padStart(2, "0")} {group.repos.length === 1 ? "repository" : "repositories"}
            </p>
          </div>
          <ul className="mt-5 grid gap-3 sm:grid-cols-2 lg:grid-cols-3 lg:gap-4">
            {group.repos.map(({ repo, number }, index) => (
              <RepoCard key={repo.name} repo={repo} number={number} index={index} />
            ))}
          </ul>
        </section>
      ))}
    </div>
  );
}
