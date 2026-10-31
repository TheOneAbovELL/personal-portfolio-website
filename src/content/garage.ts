/**
 * Curation layer for the Garage — the automatically discovered list of public GitHub
 * repositories (see `lib/github.ts`).
 *
 * New public repositories appear on their own. This file only says what to hide, how to
 * categorise, and where a better description than GitHub's is needed. Descriptions here must
 * be checkable against the repository's README.
 */

export const GITHUB_USER = "TheOneAbovELL";

/**
 * Filter buckets, in display order. The last one is the default for a repository that has no
 * override yet — new repositories land there automatically until this file says otherwise.
 */
export const GARAGE_CATEGORIES = ["AI / ML", "Research", "Systems", "Quant", "Problem solving", "Web", "New & uncategorised"] as const;
export type GarageCategory = (typeof GARAGE_CATEGORIES)[number];
export const GARAGE_DEFAULT_CATEGORY: GarageCategory = "New & uncategorised";

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
  // Homepage programmes since v6 (Ripple 03, SatQuery AI 04).
  "RIPPLE",
  "SATQUERY",
  // README currently contains placeholder badges and plain-text demo credentials; hidden until cleaned up.
  "RESUME-ANALYZER",
  // This site itself; listing it in its own Garage is self-reference.
  "personal-portfolio-website",
  // A keystroke-replay utility whose README has to argue it is not for cheating; the optics are not worth it.
  "Autotype-Script",
];

export const GARAGE_OVERRIDES: Record<string, GarageOverride> = {
  // --- October 2026 additions. Descriptions are checked against each README; attributions are kept.
  "AI-Agent-Evaluation": {
    title: "TraceGrade",
    description:
      "An evaluation workbench for tool-using LangChain agents: runs scenarios, records tool calls and traces, and scores runs with deterministic checks plus LLM-as-judge metrics — with an offline rule-based model so it works without API keys.",
    category: "AI / ML",
    priority: 4,
  },
  "RAG-evaluation": {
    title: "RAG Evaluation Workbench",
    description:
      "Runs a question-answering pipeline over a dataset, stores every answer beside its retrieved context in SQLite, and compares runs with bootstrap confidence intervals; fully offline BM25 baseline with optional LLM judges.",
    category: "AI / ML",
    priority: 4,
  },
  "Research-Agent---LangGraph": {
    title: "Research Agent (LangGraph)",
    description:
      "A LangGraph research assistant with analyst personas, a human-approval pause, parallel web-grounded interviews and a cited Markdown report. Reworked from the LangChain Academy research-assistant pattern with tests, budgets and claim verification added.",
    category: "AI / ML",
    priority: 2,
  },
  "The-Context-Illusion": {
    title: "The Context Illusion",
    description:
      "A CPU-only study of how small decoder-only Transformers lose access to relevant information as context grows, comparing six positional encodings on controlled retrieval tasks with causal interventions.",
    category: "Research",
    priority: 4,
  },
  "Inside-the-Transformers": {
    title: "Inside the Transformers",
    description:
      "A mechanistic-interpretability lab: trains small Transformers on algorithmic tasks and tests preregistered circuit hypotheses with ablation, activation patching and path interventions across seeds.",
    category: "Research",
    priority: 4,
  },
  "Beyond-Quadratic-Attention": {
    title: "Beyond Quadratic Attention",
    description:
      "A CPU-first benchmark comparing eight attention implementations — naive, SDPA, tiled online-softmax, local-window, block-sparse, linear and more — on arithmetic, memory, numerical accuracy and wall-clock as sequence length grows.",
    category: "Research",
    priority: 3,
  },
  "Chess-Engine": {
    title: "ChessLab",
    description:
      "A local chess analysis app: Stockfish analysis and play over WebSocket, Chess.com and Lichess game import, automated move-by-move review, plus an educational UCI engine written from scratch in Python.",
    category: "Systems",
    priority: 3,
  },
  F1_dashboard: {
    title: "F1 Replay Dashboard",
    description:
      "An unofficial race-replay dashboard that loads a completed race from OpenF1, derives the circuit outline from car-location data, and streams replay state to a React interface over Socket.IO.",
    category: "Web",
    priority: 3,
  },
  "Gravity-Simulator": {
    title: "Gravity Simulator",
    description:
      "An interactive 3D N-body simulator with symplectic leapfrog integration, direct-sum and Barnes-Hut solvers, J2000 solar-system initial conditions and a live energy-error readout. Extended from Gerrit Fritz's Barnes-Hut simulation, which is credited in the repository.",
    category: "Systems",
    priority: 1,
  },
  "Orbit-Simulator": {
    title: "Orbit Simulator",
    description: "A 2D Pygame gravity sandbox with fixed-step Verlet integration, merging collisions and headless tests.",
    category: "Systems",
  },
  "lyrics-video-maker": {
    title: "Lyrics Video Maker",
    description: "A single-file, browser-based tool that syncs lyrics to a track and renders an animated lyric video locally.",
    category: "Web",
  },
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
  // --- v8 (October 2026): descriptions written from each README (README.txt for the quant system).
  "quant-portfolio-research-system": {
    title: "Quant Portfolio Research System",
    description:
      "A portfolio-optimisation and rolling-backtesting framework over NSE stocks: return modelling, covariance estimation, Sharpe-maximising and minimum-variance portfolios, rolling-window optimisation and out-of-sample benchmark comparison.",
    category: "Quant",
    priority: 1,
  },
  Leetcode_submissions: {
    title: "LeetCode Submissions",
    description: "Submitted LeetCode solutions, code only, indexed by topic and difficulty in the README.",
    category: "Problem solving",
  },
  "VEDYRA-LABS": {
    title: "Vedyra Labs",
    description:
      "Startup website for a vehicle-health-analytics company, built with React 19, TanStack Start, Tailwind CSS v4 and server-side rendering.",
    category: "Web",
  },
  "college-admission-chatbot": {
    title: "College Admission Chatbot",
    description:
      "A full-stack chatbot for BIT Mesra admission queries: course-guided interaction and FAQ answers behind a floating React widget and a Flask API.",
    category: "AI / ML",
  },
  "fake-news-detector": {
    title: "TruthLens",
    description:
      "A news-credibility checker that returns signals, not a verdict: a TF-IDF plus logistic-regression wording score with word-level explanations (trained on FakeNewsNet), and an optional Groq-hosted LLM assessment of sourcing and plausibility.",
    category: "AI / ML",
    priority: 1,
  },
  "deepfake-detector": {
    title: "DeepfakeLens",
    description:
      "An EfficientNet-B0 classifier fine-tuned on the CIFAKE dataset that scores how strongly an image resembles AI-generated imagery, with a training pipeline, a Flask web app and its held-out test results stated alongside the limitations.",
    category: "AI / ML",
    priority: 1,
  },
};

/**
 * Used when the GitHub API cannot be reached at build or revalidation time.
 * Snapshot of every public repository's metadata, taken 2026-10-31 from the same endpoint
 * `lib/github.ts` calls. Hidden repositories and forks are included so that `curate` applies
 * the same rules to the snapshot as to the live list.
 */
export const GARAGE_SNAPSHOT = [
  { name: "personal-portfolio-website", fork: false, language: "TypeScript", stars: 0, pushedAt: "2026-10-31", homepage: "https://personal-portfolio-website-lilac-xi.vercel.app", description: null },
  { name: "RIPPLE", fork: false, language: "Python", stars: 0, pushedAt: "2026-10-31", homepage: null, description: null },
  { name: "RAG-evaluation", fork: false, language: "Python", stars: 0, pushedAt: "2026-10-31", homepage: null, description: null },
  { name: "Leetcode_submissions", fork: false, language: "C++", stars: 0, pushedAt: "2026-10-31", homepage: null, description: "My LeetCode submitted solutions (code only)." },
  { name: "Research-Agent---LangGraph", fork: false, language: "Python", stars: 0, pushedAt: "2026-10-30", homepage: null, description: null },
  { name: "legal-lens-backend", fork: false, language: "Python", stars: 1, pushedAt: "2026-10-27", homepage: null, description: "Legal Lens — evidence-grounded AI legal research for Indian law: FastAPI + LangGraph RAG backend (Qdrant, bge-m3, Groq) with a React/TypeScript research workspace" },
  { name: "AI-Agent-Evaluation", fork: false, language: "Python", stars: 0, pushedAt: "2026-10-24", homepage: null, description: null },
  { name: "The-Context-Illusion", fork: false, language: "Python", stars: 0, pushedAt: "2026-10-11", homepage: null, description: null },
  { name: "ARGUS", fork: false, language: "Python", stars: 0, pushedAt: "2026-10-11", homepage: "https://argus-swart-ten.vercel.app", description: null },
  { name: "AMAZON-REC-ENGINE", fork: false, language: "Python", stars: 0, pushedAt: "2026-10-11", homepage: "https://amazon-rec-engine.vercel.app", description: null },
  { name: "deepfake-detector", fork: false, language: "Python", stars: 0, pushedAt: "2026-10-11", homepage: null, description: null },
  { name: "fake-news-detector", fork: false, language: "Python", stars: 0, pushedAt: "2026-10-11", homepage: null, description: null },
  { name: "Gravity-Simulator", fork: false, language: "Python", stars: 0, pushedAt: "2026-10-11", homepage: null, description: null },
  { name: "Orbit-Simulator", fork: false, language: "Python", stars: 0, pushedAt: "2026-10-11", homepage: null, description: null },
  { name: "Autotype-Script", fork: false, language: "Python", stars: 0, pushedAt: "2026-10-11", homepage: null, description: null },
  { name: "Inside-the-Transformers", fork: false, language: "Python", stars: 0, pushedAt: "2026-10-11", homepage: null, description: null },
  { name: "Beyond-Quadratic-Attention", fork: false, language: "Python", stars: 0, pushedAt: "2026-10-11", homepage: null, description: null },
  { name: "Chess-Engine", fork: false, language: "Python", stars: 0, pushedAt: "2026-10-11", homepage: null, description: null },
  { name: "TheOneAbovELL", fork: false, language: null, stars: 0, pushedAt: "2026-10-10", homepage: null, description: null },
  { name: "F1_dashboard", fork: false, language: "TypeScript", stars: 0, pushedAt: "2026-10-07", homepage: null, description: null },
  { name: "lyrics-video-maker", fork: false, language: "HTML", stars: 0, pushedAt: "2026-10-06", homepage: null, description: null },
  { name: "Agentic-Precision-Psychiatry-System", fork: false, language: null, stars: 0, pushedAt: "2026-10-01", homepage: null, description: null },
  { name: "SATQUERY", fork: false, language: "Python", stars: 0, pushedAt: "2026-09-26", homepage: null, description: null },
  { name: "Indian-Option-Pricer", fork: false, language: "JavaScript", stars: 0, pushedAt: "2026-07-02", homepage: "https://indian-option-pricer.vercel.app", description: null },
  { name: "VEDYRA-LABS", fork: false, language: "TypeScript", stars: 0, pushedAt: "2026-06-27", homepage: "https://theoneabovell.github.io/VEDYRA-LABS/", description: null },
  { name: "RESUME-ANALYZER", fork: false, language: "Python", stars: 0, pushedAt: "2026-06-24", homepage: null, description: null },
  { name: "quant-portfolio-research-system", fork: false, language: "Python", stars: 0, pushedAt: "2026-06-08", homepage: null, description: null },
  { name: "nyay-setu-working", fork: true, language: "JavaScript", stars: 0, pushedAt: "2026-06-01", homepage: "https://nyaysetu-lovat.vercel.app/", description: "Digitalization of Judiciary System" },
  { name: "timburgan", fork: true, language: null, stars: 0, pushedAt: "2026-05-14", homepage: null, description: "Play chess via GitHub" },
  { name: "college-admission-chatbot", fork: false, language: "JavaScript", stars: 0, pushedAt: "2026-03-24", homepage: null, description: null },
  { name: "signal-feed-india", fork: false, language: "Python", stars: 1, pushedAt: "2026-03-14", homepage: "https://signal-feed-india.vercel.app", description: null },
  { name: "interview-coder-withoupaywall-opensource", fork: true, language: null, stars: 1, pushedAt: "2025-08-09", homepage: null, description: "interview-coder-withoupaywall-opensource" },
  { name: "LeetCode-Questions-CompanyWise", fork: true, language: null, stars: 0, pushedAt: "2024-06-23", homepage: null, description: "Contains Company Wise Questions sorted based on Frequency and all time" },
];
