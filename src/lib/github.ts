import {
  GARAGE_HIDDEN,
  GARAGE_OVERRIDES,
  GARAGE_SNAPSHOT,
  GITHUB_USER,
  type GarageCategory,
} from "@/content/garage";

export interface GarageRepo {
  /** Repository name on GitHub. */
  name: string;
  /** Presentable name. */
  title: string;
  description: string | null;
  url: string;
  /** Live demo, when the repository declares one. */
  homepage: string | null;
  language: string | null;
  stars: number;
  /** ISO date of the last push. */
  pushedAt: string;
  category: GarageCategory;
  fork: boolean;
  archived: boolean;
  /** Pushed to within the last 90 days (as of the last revalidation). */
  active: boolean;
  /**
   * Commits per week over the last 52 weeks, oldest first, from GitHub's participation
   * statistics. Null when GitHub has not computed them yet (it answers 202) or is unreachable.
   */
  activity: number[] | null;
}

export interface Garage {
  repos: GarageRepo[];
  /** False when the committed snapshot was used instead of the live API. */
  live: boolean;
}

interface ApiRepo {
  name: string;
  fork: boolean;
  archived?: boolean;
  private?: boolean;
  language: string | null;
  stargazers_count: number;
  pushed_at: string;
  homepage: string | null;
  description: string | null;
  html_url: string;
}

const SIX_HOURS = 60 * 60 * 6;

const presentable = (name: string) => name.replace(/[-_]+/g, " ").replace(/\s+/g, " ").trim();

/** True when a URL answers with a success status. Cached with the rest of the Garage data. */
async function isReachable(url: string): Promise<boolean> {
  try {
    const response = await fetch(url, { next: { revalidate: SIX_HOURS }, signal: AbortSignal.timeout(5000) });
    return response.ok;
  } catch {
    return false;
  }
}

/** Drop demo links that are curated out or no longer resolve — a dead link is worse than none. */
async function verifyDemos(repos: GarageRepo[]): Promise<GarageRepo[]> {
  return Promise.all(
    repos.map(async (repo) => {
      if (!repo.homepage) return repo;
      const allowed = GARAGE_OVERRIDES[repo.name]?.demo !== false;
      const live = allowed && /^https:\/\//.test(repo.homepage) && (await isReachable(repo.homepage));
      return live ? repo : { ...repo, homepage: null };
    }),
  );
}

const ACTIVE_WINDOW_MS = 90 * 24 * 60 * 60 * 1000;

function curate(raw: Omit<GarageRepo, "title" | "category" | "active" | "activity">[]): GarageRepo[] {
  const now = Date.now();
  const hidden = new Set(GARAGE_HIDDEN.map((name) => name.toLowerCase()));
  return raw
    .filter((repo) => !hidden.has(repo.name.toLowerCase()))
    .filter((repo) => !repo.fork || GARAGE_OVERRIDES[repo.name]?.include)
    .map((repo) => {
      const override = GARAGE_OVERRIDES[repo.name] ?? {};
      return {
        ...repo,
        title: override.title ?? presentable(repo.name),
        description: override.description ?? repo.description,
        category: override.category ?? "Other",
        active: !repo.archived && now - Date.parse(repo.pushedAt) < ACTIVE_WINDOW_MS,
        activity: null,
      };
    })
    .sort((a, b) => {
      const priority = (GARAGE_OVERRIDES[b.name]?.priority ?? 0) - (GARAGE_OVERRIDES[a.name]?.priority ?? 0);
      return priority !== 0 ? priority : b.pushedAt.localeCompare(a.pushedAt);
    });
}

/**
 * Weekly commit counts for the last year. GitHub computes these lazily: the first request can
 * answer 202 with no body while it works, so anything but a full 52-week array is treated as
 * "not available" and the row simply shows no trace. Cached with the rest of the Garage data.
 */
async function participation(name: string, headers: HeadersInit): Promise<number[] | null> {
  try {
    const response = await fetch(`https://api.github.com/repos/${GITHUB_USER}/${name}/stats/participation`, {
      headers,
      next: { revalidate: SIX_HOURS },
      signal: AbortSignal.timeout(5000),
    });
    if (response.status !== 200) return null;
    const body = (await response.json()) as { all?: unknown };
    const weeks = body.all;
    if (!Array.isArray(weeks) || weeks.length !== 52 || !weeks.every((n) => typeof n === "number")) return null;
    return weeks as number[];
  } catch {
    return null;
  }
}

/**
 * Public repositories for the Garage.
 *
 * Fetched on the server and cached for six hours (ISR), so visitors never wait on GitHub and
 * no token reaches the browser. `GITHUB_TOKEN` is optional — it only raises the rate limit.
 * Only public repository metadata is requested. Any failure falls back to a committed snapshot.
 */
export async function getGarage(): Promise<Garage> {
  try {
    const token = process.env.GITHUB_TOKEN;
    const headers = {
      Accept: "application/vnd.github+json",
      "User-Agent": "omjee-portfolio",
      ...(token ? { Authorization: `Bearer ${token}` } : {}),
    };
    const response = await fetch(
      `https://api.github.com/users/${GITHUB_USER}/repos?per_page=100&sort=pushed&type=owner`,
      {
        headers,
        next: { revalidate: SIX_HOURS },
        signal: AbortSignal.timeout(6000),
      },
    );
    if (!response.ok) throw new Error(`GitHub responded ${response.status}`);
    const data = (await response.json()) as ApiRepo[];
    if (!Array.isArray(data)) throw new Error("Unexpected GitHub response");

    const repos = curate(
      data
        .filter((repo) => !repo.private)
        .map((repo) => ({
          name: repo.name,
          description: repo.description,
          url: repo.html_url,
          homepage: repo.homepage || null,
          language: repo.language,
          stars: repo.stargazers_count,
          pushedAt: repo.pushed_at.slice(0, 10),
          fork: repo.fork,
          archived: Boolean(repo.archived),
        })),
    );
    const [verified, activity] = await Promise.all([
      verifyDemos(repos),
      Promise.all(repos.map((repo) => participation(repo.name, headers))),
    ]);
    return { repos: verified.map((repo, i) => ({ ...repo, activity: activity[i] })), live: true };
  } catch {
    const repos = curate(
      GARAGE_SNAPSHOT.map((repo) => ({
        ...repo,
        url: `https://github.com/${GITHUB_USER}/${repo.name}`,
        archived: false,
      })),
    );
    return { repos, live: false };
  }
}
