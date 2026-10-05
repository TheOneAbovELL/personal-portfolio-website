import { codeforcesSnapshot } from "@/content/achievements";

export interface CodeforcesData {
  handle: string;
  rank: string;
  rating: number;
  maxRating: number;
  history: { date: string; rating: number }[];
  /** False when the live API could not be reached and the committed snapshot was used. */
  live: boolean;
}

const API = "https://codeforces.com/api";
const ONE_DAY = 60 * 60 * 24;

async function call<T>(path: string): Promise<T> {
  const response = await fetch(`${API}/${path}`, {
    next: { revalidate: ONE_DAY },
    signal: AbortSignal.timeout(5000),
  });
  if (!response.ok) throw new Error(`Codeforces responded ${response.status}`);
  const body = (await response.json()) as { status: string; result: T };
  if (body.status !== "OK") throw new Error("Codeforces returned a non-OK status");
  return body.result;
}

/**
 * Current Codeforces standing, refreshed at most once a day.
 * Any failure — network, rate limit, unexpected shape — falls back to the snapshot in
 * `content/achievements.ts`, so the page always renders.
 */
export async function getCodeforces(): Promise<CodeforcesData> {
  const { handle } = codeforcesSnapshot;
  try {
    const [info, changes] = await Promise.all([
      call<{ rank?: string; rating?: number; maxRating?: number }[]>(`user.info?handles=${handle}`),
      call<{ ratingUpdateTimeSeconds: number; newRating: number }[]>(`user.rating?handle=${handle}`),
    ]);
    const user = info[0];
    if (!user?.rating || !user.rank || changes.length === 0) throw new Error("Incomplete Codeforces data");
    return {
      handle,
      rank: user.rank,
      rating: user.rating,
      maxRating: user.maxRating ?? user.rating,
      history: changes.map((change) => ({
        date: new Date(change.ratingUpdateTimeSeconds * 1000).toISOString().slice(0, 10),
        rating: change.newRating,
      })),
      live: true,
    };
  } catch {
    return { ...codeforcesSnapshot, live: false };
  }
}
