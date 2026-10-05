import type { SkillDomain } from "./types";

/**
 * Capabilities, grouped by domain. Each domain points at evidence — where the skill was
 * actually used. To add a technology, append it to `items`. To add a domain, append an
 * object; the layout adapts.
 *
 * No proficiency scores. Only list things Omjee can discuss in depth.
 */
export const skills: SkillDomain[] = [
  {
    id: "ai-ml",
    title: "AI / ML",
    summary: "Models and the methods around them.",
    items: [
      "Machine learning",
      "Deep learning",
      "NLP",
      "Transformers",
      "LLMs",
      "RAG",
      "Agentic AI",
      "Feature engineering",
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
      "LangGraph",
      "Vector search",
      "Qdrant",
      "API architecture",
      "Streaming / SSE",
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
      "Data structures & algorithms",
      "Git / GitHub",
      "Docker",
      "Docker Compose",
      "CI/CD",
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
    items: ["SQL", "NumPy", "Pandas", "Statistics", "Data analysis", "Data visualization"],
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
      "Signal processing",
      "Spectral analysis",
      "Feature extraction",
      "CNN",
      "GNN",
      "Transformers",
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
