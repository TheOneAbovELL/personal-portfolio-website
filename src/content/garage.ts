/**
 * Curation layer for the Garage — the automatically discovered list of public GitHub
 * repositories (see `lib/github.ts`).
 *
 * New public repositories appear on their own. This file only says what to hide, how to
 * categorise, and where a better description than GitHub's is needed. Descriptions here must
 * be checkable against the repository's README.
 */

export const GITHUB_USER = "TheOneAbovELL";

export const GARAGE_CATEGORIES = ["AI / ML", "Systems", "Quant", "Problem solving", "Web", "Other"] as const;
export type GarageCategory = (typeof GARAGE_CATEGORIES)[number];

export interface GarageOverride {
  /** Display name, when the repository name is not presentable. */
  title?: string;
  description?: string;
  category?: GarageCategory;
  /** Higher sorts first; ties fall back to most recently pushed. Default 0. */
  priority?: number;
  /** Forks are hidden unless this is set. */
  include?: boolean;
  /** Set to false when the repository's homepage is not Omjee's own deployment. */
  demo?: boolean;
}

/** Repositories that never appear in the Garage. */
export const GARAGE_HIDDEN: string[] = [
  // Profile README, not a project.
  "TheOneAbovELL",
  // Featured projects have their own case studies.
  "legal-lens-backend",
  "ARGUS",
  "Agentic-Precision-Psychiatry-System",
  // README currently contains placeholder badges and plain-text demo credentials; hidden until cleaned up.
  "RESUME-ANALYZER",
];

export const GARAGE_OVERRIDES: Record<string, GarageOverride> = {
  "Indian-Option-Pricer": {
    title: "Indian Option Pricer",
    description:
      "Option pricing with Indian market conventions: Black–Scholes–Merton, Monte Carlo and binomial models, Greeks and an implied-volatility solver.",
    category: "Quant",
    priority: 3,
  },
  SATQUERY: {
    title: "SatQuery",
    description:
      "Smart India Hackathon 2026 prototype: natural-language questions over satellite imagery, with geospatial tools computing the measurements.",
    category: "AI / ML",
    priority: 3,
  },
  "signal-feed-india": {
    title: "Signal Feed India",
    description: "Real-time news dashboard: async RSS ingestion, de-duplication, clustering and WebSocket updates.",
    category: "Systems",
    priority: 2,
  },
  "AMAZON-REC-ENGINE": {
    title: "Semantic Recommendation Engine",
    description: "Retrieve-then-rank product recommendations: sentence embeddings, FAISS search and multi-signal ranking.",
    category: "AI / ML",
    priority: 2,
  },
  "nyay-setu-working": {
    title: "Nyay Setu (fork)",
    description: "Working fork for GSSoC 2026 contributions to the Nyay Setu judiciary platform — 7 pull requests merged upstream.",
    category: "Systems",
    priority: 2,
    include: true,
    // The homepage on this fork is the upstream project's deployment.
    demo: false,
  },
  "quant-portfolio-research-system": { title: "Quant Portfolio Research System", category: "Quant" },
  Leetcode_submissions: { title: "LeetCode Submissions", category: "Problem solving" },
  "VEDYRA-LABS": {
    title: "Vedyra Labs",
    description: "Marketing website for a vehicle-health-analytics startup.",
    category: "Web",
  },
  "college-admission-chatbot": { title: "College Admission Chatbot", category: "AI / ML" },
  "fake-news-detector": { title: "Fake News Detector", category: "AI / ML" },
  "deepfake-detector": { title: "Deepfake Detector", category: "AI / ML" },
};

/**
 * Used when the GitHub API cannot be reached at build or revalidation time.
 * Snapshot of public repository metadata taken 2026-10-05.
 */
export const GARAGE_SNAPSHOT = [
  { name: "Leetcode_submissions", fork: false, language: "C++", stars: 0, pushedAt: "2026-10-05", homepage: null, description: "My LeetCode submitted solutions (code only)." },
  { name: "AMAZON-REC-ENGINE", fork: false, language: "Python", stars: 0, pushedAt: "2026-09-26", homepage: null, description: null },
  { name: "SATQUERY", fork: false, language: "Python", stars: 0, pushedAt: "2026-09-26", homepage: null, description: null },
  { name: "Indian-Option-Pricer", fork: false, language: "JavaScript", stars: 0, pushedAt: "2026-07-02", homepage: "https://indian-option-pricer.vercel.app", description: null },
  { name: "VEDYRA-LABS", fork: false, language: "TypeScript", stars: 0, pushedAt: "2026-06-27", homepage: null, description: null },
  { name: "quant-portfolio-research-system", fork: false, language: "Python", stars: 0, pushedAt: "2026-06-08", homepage: null, description: null },
  { name: "nyay-setu-working", fork: true, language: "JavaScript", stars: 0, pushedAt: "2026-06-01", homepage: null, description: "Digitalization of Judiciary System" },
  { name: "college-admission-chatbot", fork: false, language: "JavaScript", stars: 0, pushedAt: "2026-03-24", homepage: null, description: null },
  { name: "signal-feed-india", fork: false, language: "Python", stars: 1, pushedAt: "2026-03-14", homepage: null, description: null },
  { name: "fake-news-detector", fork: false, language: "Python", stars: 0, pushedAt: "2026-03-13", homepage: null, description: null },
  { name: "deepfake-detector", fork: false, language: "Python", stars: 0, pushedAt: "2026-03-13", homepage: null, description: null },
];
