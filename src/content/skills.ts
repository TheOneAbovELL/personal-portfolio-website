import type { SkillDomain } from "./types";

/**
 * Capabilities, grouped by domain. Each domain points at evidence — where the skill was
 * actually used. To add a technology, append it to `items`. To add a domain, append an
 * object; the layout adapts.
 *
 * No proficiency scores. Only list things Omjee can discuss in depth. Every item here is on
 * the résumé or in a project's stack.
 */
export const skills: SkillDomain[] = [
  {
    id: "ai-ml",
    title: "AI / ML",
    summary: "Models, retrieval and the methods around them.",
    items: [
      "Machine learning",
      "Deep learning",
      "PyTorch",
      "scikit-learn",
      "Hugging Face",
      "NLP",
      "Transformers",
      "LLMs",
      "RAG",
      "Hybrid retrieval",
      "Reranking",
      "Evaluation",
      "Vision-language models",
      "LoRA (PEFT)",
      "Agentic AI",
    ],
    evidence: [
      {
        source: "Legal Lens",
        note: "Adaptive retrieval-augmented generation with citation validation",
        href: "/work/legal-lens",
      },
      {
        source: "qEEG Subtyping",
        note: "Hybrid CNN + GCN + Transformer classifier",
        href: "/work/qeeg",
      },
    ],
  },
  {
    id: "ai-systems",
    title: "AI systems",
    summary: "The backends that make models usable.",
    items: [
      "Python",
      "FastAPI",
      "Pydantic",
      "AsyncIO",
      "LangGraph",
      "LangChain",
      "Vector search",
      "Qdrant",
      "ChromaDB",
      "FAISS",
      "Neo4j",
      "SSE streaming",
      "WebSockets",
      "API architecture",
    ],
    evidence: [
      {
        source: "Legal Lens",
        note: "16-node LangGraph pipeline, hybrid search on Qdrant, typed SSE events",
        href: "/work/legal-lens",
      },
      {
        source: "Nyay Setu (GSSoC)",
        note: "Provider retry and fallback, streaming responses, response caching",
        href: "/#experience",
      },
    ],
  },
  {
    id: "software-engineering",
    title: "Software engineering",
    summary: "Fundamentals, tooling and delivery.",
    items: [
      "C++",
      "C",
      "TypeScript",
      "JavaScript",
      "React",
      "Next.js",
      "Data structures & algorithms",
      "Git / GitHub",
      "Docker",
      "CI/CD",
      "Pytest",
      "Playwright",
      "Linux",
    ],
    evidence: [
      {
        source: "Codeforces",
        note: "Specialist — rated contests in C++",
        href: "/#experience",
      },
      {
        source: "Legal Lens",
        note: "Containerised API and client, CI with contract and end-to-end tests",
        href: "/work/legal-lens",
      },
      {
        source: "Open source",
        note: "7 pull requests merged into a shared codebase",
        href: "/#experience",
      },
    ],
  },
  {
    id: "data",
    title: "Data",
    summary: "Getting from raw records to something a model can use.",
    items: ["SQL", "MySQL", "SQLite", "NumPy", "Pandas", "SciPy", "Statistics", "Data visualization", "Rasterio", "Shapely"],
    evidence: [
      {
        source: "Semantic Recommendation Engine",
        note: "Feature normalisation and multi-signal ranking with Pandas",
        href: "/#garage",
      },
      {
        source: "IIT Madras",
        note: "BS in Data Science and Applications",
        href: "/#experience",
      },
    ],
  },
  {
    id: "research",
    title: "Research",
    summary: "Signals, features and experimental models.",
    items: [
      "EEG / qEEG",
      "MNE-Python",
      "Signal processing",
      "Spectral analysis",
      "Feature extraction",
      "CNN",
      "GNN",
      "Transformers",
      "Transformer internals",
      "Controlled experiments",
    ],
    evidence: [
      {
        source: "qEEG Subtyping",
        note: "19-channel preprocessing, spectral / connectivity / nonlinear features, three-branch model",
        href: "/work/qeeg",
      },
    ],
  },
  {
    id: "quantitative",
    title: "Quantitative",
    summary: "Risk, return and the maths behind them.",
    items: [
      "Probability",
      "Statistics",
      "Quantitative analysis",
      "Financial data",
      "Volatility",
      "Sharpe ratio",
      "Beta",
      "Drawdown",
      "Option pricing",
    ],
    evidence: [
      {
        source: "ARGUS",
        note: "Deterministic, unit-tested risk metrics for assets and portfolios",
        href: "/work/argus",
      },
      {
        source: "Indian Option Pricer",
        note: "Black–Scholes, Monte Carlo and binomial pricing with Greeks",
        href: "/#garage",
      },
    ],
  },
];

/**
 * Where a single tool or concept was used, and how — one line each.
 *
 * `slug` points at a project in content/projects.ts (resolved at render time, so a project
 * that is hidden or not yet added simply drops out). `source` + `href` is for work that is not
 * a project page, such as an open-source contribution.
 *
 * Tools listed in a project's `stack` are matched automatically (see `skillAliases`); entries
 * here add the "how", and cover concepts no stack names (RAG, reranking, Sharpe ratio…).
 */
export interface SkillUse {
  slug?: string;
  source?: string;
  href?: string;
  note: string;
}

const NYAY_SETU = { source: "Nyay Setu (GSSoC 2026)", href: "/#experience" } as const;
const CODEFORCES = { source: "Codeforces", href: "/#experience" } as const;

export const skillUses: Record<string, SkillUse[]> = {
  // AI / ML
  "Machine learning": [
    { slug: "semantic-recommender", note: "Embedding retrieval, multi-signal ranking, Precision / Recall / NDCG evaluation" },
    { slug: "qeeg", note: "Subtype classification of quantitative-EEG recordings" },
  ],
  "Deep learning": [
    { slug: "qeeg", note: "Three branches — 1D-CNN, GCN, Transformer — fused into a six-class output" },
    { slug: "context-illusion", note: "Small Transformers trained from scratch on controlled retrieval tasks" },
    { slug: "inside-transformers", note: "Transparent models trained to implement algorithmic tasks" },
  ],
  NLP: [
    { slug: "legal-lens", note: "Rule-based query complexity scoring routes each question to a retrieval profile" },
    { ...NYAY_SETU, note: "Retry and fallback in the NLP orchestrator, caching for repeated requests" },
  ],
  Transformers: [
    { slug: "qeeg", note: "Transformer branch for long-range dependencies" },
    { slug: "context-illusion", note: "Six positional encodings behind one interface" },
    { slug: "beyond-quadratic", note: "Eight attention implementations compared on correctness, memory and time" },
  ],
  LLMs: [
    { slug: "legal-lens", note: "Evidence gate skips the model on weak evidence; retries, provider fallback, circuit breaker" },
    { slug: "ripple", note: "The model decides only how to fix a belief, and its answer is schema-validated first" },
    { slug: "satquery", note: "A vision-language model interprets measurements it never computes" },
  ],
  RAG: [
    { slug: "legal-lens", note: "16-node LangGraph pipeline; unknown citation IDs are rejected before an answer is accepted" },
    { slug: "rag-workbench", note: "Every answer kept beside the exact context it was given; runs compared statistically" },
    { slug: "argus", note: "Retrieval layer that returns page-level provenance" },
  ],
  "Hybrid retrieval": [
    { slug: "legal-lens", note: "BGE-M3 dense, BM25-style sparse, metadata and Neo4j retrieval fused with weighted RRF" },
  ],
  Reranking: [
    { slug: "legal-lens", note: "On an 18-query labelled set a lexical reranker matched a cross-encoder at about a quarter of the latency" },
    { slug: "semantic-recommender", note: "Candidates re-ranked on five signals, including similarity, rating and budget fit" },
  ],
  Evaluation: [
    { slug: "legal-lens", note: "Harness for Recall@K, MRR, nDCG and citation validity" },
    { slug: "tracegrade", note: "Deterministic checks and LLM-as-judge metrics, never merged into one number" },
    { slug: "rag-workbench", note: "Paired statistics between runs" },
  ],
  "Vision-language models": [
    { slug: "satquery", note: "Qwen2-VL-2B-Instruct over optical, multispectral and SAR imagery" },
  ],
  "LoRA (PEFT)": [{ slug: "satquery", note: "A remote-sensing LoRA adapter on Qwen2-VL" }],
  "Agentic AI": [
    { slug: "argus", note: "Four rule-based agents run concurrently with asyncio" },
    { slug: "tracegrade", note: "Tool-using LangChain agents scored on what they did, not what they said" },
    { slug: "qeeg", note: "Agentic orchestration layer around the pipeline" },
    { slug: "ripple", note: "Agent memory where a changed fact re-checks every belief built on it" },
  ],

  // AI systems
  FastAPI: [
    { slug: "legal-lens", note: "SSE streaming with typed events, authentication, persisted conversations" },
    { slug: "argus", note: "Research backend serving deterministic metrics" },
  ],
  LangGraph: [{ slug: "legal-lens", note: "16 nodes; each query routed to one of 3 retrieval profiles" }],
  LangChain: [{ slug: "tracegrade", note: "The agents under test, with tool calls and side effects recorded" }],
  "Vector search": [
    { slug: "legal-lens", note: "Hybrid search on Qdrant" },
    { slug: "semantic-recommender", note: "Exact FAISS search over 50,000+ products, sub-second" },
    { slug: "argus", note: "ChromaDB retrieval with page-level citations" },
  ],
  Qdrant: [{ slug: "legal-lens", note: "The store behind dense, sparse and metadata retrieval" }],
  Neo4j: [{ slug: "legal-lens", note: "Graph retrieval fused with dense and sparse results" }],
  ChromaDB: [{ slug: "argus", note: "Knowledge layer returning page-level provenance" }],
  FAISS: [{ slug: "semantic-recommender", note: "Exact search over all-MiniLM-L6-v2 embeddings" }],
  "SSE streaming": [
    { slug: "legal-lens", note: "Typed SSE events from the pipeline to the client" },
    { ...NYAY_SETU, note: "Streaming token responses" },
  ],
  WebSockets: [
    { slug: "signal-feed-india", note: "Pushes clustered stories to the browser as they arrive" },
    { slug: "f1-replay", note: "Replay state streamed to the dashboard over Socket.IO" },
  ],
  "API architecture": [
    { slug: "legal-lens", note: "Retries, provider fallback and a circuit breaker around every model call" },
    { ...NYAY_SETU, note: "IP-based rate limiting on authentication endpoints" },
  ],

  // Software engineering
  "C++": [{ ...CODEFORCES, note: "Rated contests, Specialist" }],
  "Data structures & algorithms": [
    { ...CODEFORCES, note: "Rated contests in C++" },
    { slug: "chesslab", note: "An educational UCI chess engine written from scratch" },
  ],
  "Git / GitHub": [{ ...NYAY_SETU, note: "7 pull requests merged into a shared codebase" }],
  "CI/CD": [{ slug: "legal-lens", note: "GitHub Actions running offline and end-to-end tests" }],
  Pytest: [
    { slug: "legal-lens", note: "160+ offline backend tests" },
    { slug: "argus", note: "56+ offline tests" },
    { ...NYAY_SETU, note: "40+ cases for the citation-verification layer" },
  ],
  Playwright: [{ slug: "legal-lens", note: "End-to-end tests of the research client" }],

  // Data
  Pandas: [{ slug: "semantic-recommender", note: "Feature normalisation for multi-signal ranking" }],
  Statistics: [
    { slug: "rag-workbench", note: "Paired comparisons between evaluation runs" },
    { source: "IIT Madras", href: "/#experience", note: "BS in Data Science and Applications" },
  ],
  Rasterio: [{ slug: "satquery", note: "Deterministic geospatial tools compute the measurements" }],
  Shapely: [{ slug: "satquery", note: "Deterministic geospatial tools compute the measurements" }],

  // Research
  "EEG / qEEG": [{ slug: "qeeg", note: "19-channel recordings: filtering, ICA, re-referencing, epoching" }],
  "MNE-Python": [{ slug: "qeeg", note: "The preprocessing pipeline" }],
  "Signal processing": [{ slug: "qeeg", note: "Filtering, ICA and epoching before feature extraction" }],
  "Spectral analysis": [{ slug: "qeeg", note: "Spectral features alongside connectivity and nonlinear ones" }],
  "Feature extraction": [{ slug: "qeeg", note: "Spectral, connectivity and nonlinear features" }],
  CNN: [{ slug: "qeeg", note: "1D-CNN branch for local patterns" }],
  GNN: [{ slug: "qeeg", note: "GCN over measured channel coherence — the graph comes from the data" }],
  "Transformer internals": [
    { slug: "inside-transformers", note: "Ablation, activation and path patching; preregistered circuit hypotheses" },
    { slug: "context-illusion", note: "Mechanistic diagnostics and causal interventions" },
    { slug: "beyond-quadratic", note: "What attention costs in arithmetic, memory and time as sequences grow" },
  ],
  "Controlled experiments": [
    { slug: "context-illusion", note: "Synthetic retrieval tasks on CPU, no pretrained model" },
    { slug: "inside-transformers", note: "Exact solvers, held-out examples, multiple seeds" },
    { slug: "beyond-quadratic", note: "Theory labelled as theory, measurement as measurement" },
  ],

  // Quantitative
  "Quantitative analysis": [{ slug: "argus", note: "Return, volatility, Sharpe, beta and drawdown for assets and portfolios" }],
  "Financial data": [{ slug: "argus", note: "Market data through yfinance" }],
  Volatility: [
    { slug: "argus", note: "A pure, unit-tested function — never generated by a model" },
    { slug: "indian-option-pricer", note: "Newton–Raphson implied-volatility solver" },
  ],
  "Sharpe ratio": [{ slug: "argus", note: "Computed, never generated by a language model" }],
  Beta: [{ slug: "argus", note: "For assets and portfolios" }],
  Drawdown: [{ slug: "argus", note: "Maximum drawdown for assets and portfolios" }],
  Probability: [{ slug: "indian-option-pricer", note: "Antithetic Monte Carlo pricing" }],
  "Option pricing": [
    { slug: "indian-option-pricer", note: "Black–Scholes–Merton, Monte Carlo and a CRR binomial tree side by side, with per-lot Greeks" },
  ],
};

/** Other names a tool goes by in project stacks, for automatic matching. */
export const skillAliases: Record<string, string[]> = {
  "LoRA (PEFT)": ["LoRA", "PEFT"],
  "Vision-language models": ["Qwen2-VL"],
  "SSE streaming": ["SSE"],
  WebSockets: ["Socket.IO"],
  "CI/CD": ["GitHub Actions"],
  "Hugging Face": ["Sentence-Transformers"],
  "Data visualization": ["Matplotlib", "Recharts"],
  SQL: ["SQLite", "MySQL", "SQLAlchemy"],
  "Vector search": ["Qdrant", "FAISS", "ChromaDB"],
};
