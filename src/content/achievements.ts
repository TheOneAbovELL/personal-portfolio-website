import type { Achievement } from "./types";

/**
 * Keep this short. Two or three facts carry more weight than a wall of badges.
 * The Codeforces entry is rendered separately with live data — see `lib/codeforces.ts`.
 */
export const achievements: Achievement[] = [
  {
    id: "gssoc-2026",
    title: "GirlScript Summer of Code 2026",
    detail: "Global rank 1,065 among 70,000+ registered contributors, with 7 pull requests merged.",
    href: "https://github.com/viru0909-dev/nyay-setu-working/pulls?q=is%3Apr+author%3ATheOneAbovELL+is%3Amerged",
    linkLabel: "View merged pull requests",
  },
];

/**
 * Codeforces rating history. Used as-is if the live API cannot be reached at build or
 * revalidation time. Snapshot taken 2026-10-05 from codeforces.com/api/user.rating.
 */
export const codeforcesSnapshot = {
  handle: "The0NEAboveALL",
  rank: "specialist",
  rating: 1411,
  maxRating: 1411,
  history: [
    { date: "2025-05-24", rating: 378 },
    { date: "2025-06-08", rating: 634 },
    { date: "2025-06-12", rating: 783 },
    { date: "2025-06-21", rating: 1002 },
    { date: "2025-06-23", rating: 982 },
    { date: "2025-12-29", rating: 1121 },
    { date: "2026-01-12", rating: 1195 },
    { date: "2026-01-23", rating: 1161 },
    { date: "2026-07-12", rating: 1149 },
    { date: "2026-08-07", rating: 1115 },
    { date: "2026-09-13", rating: 1260 },
    { date: "2026-09-25", rating: 1314 },
    { date: "2026-09-26", rating: 1411 },
  ],
};
