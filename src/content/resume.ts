/**
 * The résumé, as structured content.
 *
 * This file MIRRORS the PDF served at /resume.pdf (src/lib/resume.ts, from the Drive folder).
 * It exists so Ask Omjee can answer from the résumé without a PDF parser at runtime. When the
 * PDF changes, update this file with it: every line here should be checkable against the PDF.
 *
 * Deliberately omitted: the phone number. The portfolio publishes email and profiles only.
 */

export interface ResumeEducation {
  institution: string;
  /** Short name used in answers, e.g. "BIT Mesra". */
  short: string;
  degree: string;
  field: string;
  /** As printed, e.g. "Aug 2024 – Present". */
  period: string;
  /** As printed, e.g. "7.6/10". */
  cgpa: string;
}

export interface ResumeRole {
  role: string;
  organization: string;
  /** Short name used in citations, e.g. "GSSoC 2026". */
  short: string;
  period: string;
  bullets: string[];
}

export interface ResumeProject {
  title: string;
  /** Short name used in citations. */
  short: string;
  /** The portfolio project this entry describes, when there is one. */
  slug?: string;
  /** The qualifier printed beside the title: a repository, or "Research Prototype (in progress)". */
  note?: string;
  bullets: string[];
  stack: string[];
  live?: string;
}

export interface ResumeSkillGroup {
  group: string;
  items: string[];
}

export const resume = {
  href: "/resume.pdf",

  summary:
    "AI/ML engineering student (B.Tech AI&ML, BIT Mesra; BS Data Science, IIT Madras) building RAG, LLM and NLP systems with hybrid retrieval, reranking, citation validation and automated evaluation. Undergraduate research assistant, GSSoC 2026 contributor and Codeforces Specialist (Max - 1491), seeking AI/ML and Software Engineering internships.",

  links: [
    "omjeergiri@gmail.com",
    "linkedin.com/in/omjee-r-giri",
    "github.com/TheOneAbovELL",
    "omjeergiri.vercel.app",
    "leetcode.com/u/TheOneAbovELL",
    "codeforces.com/profile/The0NEAboveALL",
  ],

  education: [
    {
      institution: "Birla Institute of Technology, Mesra",
      short: "BIT Mesra",
      degree: "B.Tech",
      field: "Artificial Intelligence and Machine Learning",
      period: "Aug 2024 – Present",
      cgpa: "7.6/10",
    },
    {
      institution: "Indian Institute of Technology, Madras",
      short: "IIT Madras",
      degree: "BS",
      field: "Data Science and Applications",
      period: "Jan 2025 – Present",
      cgpa: "7.0/10",
    },
  ] satisfies ResumeEducation[],

  experience: [
    {
      role: "Undergraduate Research Assistant",
      organization: "BIT Mesra, Dept. of Computer Science",
      short: "BIT Mesra",
      period: "Jan 2026 – Present",
      bullets: [
        "Design and build Legal Lens, an evidence-grounded legal research system for Indian law, owning its backend and retrieval architecture.",
        "Set up the evaluation harness (Recall@K, MRR, nDCG, citation validity) used to compare chunking and reranking strategies.",
      ],
    },
    {
      role: "Open-Source Contributor",
      organization: "GirlScript Summer of Code (GSSoC) 2026",
      short: "GSSoC 2026",
      period: "May 2026 – August 2026",
      bullets: [
        "Merged 7 PRs into Nyay Setu, a digital judiciary platform (github.com/viru0909-dev/nyay-setu-working).",
        "Added provider retry and fallback to the NLP orchestrator, and a citation-verification layer with BNS/BNSS section-range rules and 40+ Pytest cases.",
        "Added streaming token responses, caching for repeated NLP requests, and IP-based rate limiting on authentication endpoints.",
      ],
    },
  ] satisfies ResumeRole[],

  projects: [
    {
      title: "Legal Lens: Evidence-Grounded Legal Research for Indian Law",
      short: "Legal Lens",
      slug: "legal-lens",
      note: "github.com/TheOneAbovELL/legal-lens-backend",
      bullets: [
        "Built a 16-node LangGraph RAG pipeline that routes each query to one of 3 retrieval profiles via a rule-based complexity score, fusing BGE-M3 dense, BM25-style sparse, metadata and Neo4j retrieval on Qdrant with weighted RRF.",
        "Added an evidence gate that skips the LLM on weak evidence and citation validation that rejects unknown citation IDs; model calls use retries, provider fallback and a circuit breaker.",
        "On an 18-query labelled set, a lexical reranker matched a cross-encoder at about a quarter of the latency, so it became the default; 160+ offline tests, Playwright E2E and CI.",
      ],
      stack: ["Python", "FastAPI", "LangGraph", "Qdrant", "BGE-M3", "Groq", "Neo4j", "React", "TypeScript", "Docker", "GitHub Actions"],
    },
    {
      title: "qEEG Subtyping: Multi-Branch Deep Learning on EEG",
      short: "qEEG Subtyping",
      slug: "qeeg",
      note: "Research Prototype (in progress)",
      bullets: [
        "Built 19-channel EEG preprocessing (filtering, ICA, re-referencing, epoching) and spectral, connectivity and nonlinear feature extraction.",
        "Designing a three-branch classifier (1D-CNN for local patterns, GCN over measured channel coherence, Transformer for long-range dependencies) fused into a six-class output.",
      ],
      stack: ["Python", "PyTorch", "MNE-Python", "NumPy", "SciPy"],
    },
    {
      title: "ARGUS: Quantitative Research Backend",
      short: "ARGUS",
      slug: "argus",
      note: "github.com/TheOneAbovELL/ARGUS",
      bullets: [
        "Built an equity research backend where no metric comes from an LLM: pure, unit-tested functions compute return, volatility, Sharpe, beta and max drawdown for assets and portfolios.",
        "Runs 4 rule-based agents concurrently with asyncio, plus a ChromaDB retrieval layer that returns page-level provenance; 56+ offline tests.",
      ],
      stack: ["Python", "FastAPI", "AsyncIO", "Pydantic", "ChromaDB", "yfinance", "Next.js"],
    },
    {
      title: "Semantic Product Recommendation Engine",
      short: "Semantic Recommendation Engine",
      slug: "semantic-recommender",
      note: "github.com/TheOneAbovELL/AMAZON-REC-ENGINE",
      bullets: [
        "Built retrieve-then-rank recommendations with all-MiniLM-L6-v2 embeddings and FAISS over 50,000+ products (sub-second retrieval), re-ranked on five signals including similarity, rating and budget fit.",
      ],
      stack: ["Python", "Sentence Transformers", "FAISS", "Pandas", "scikit-learn", "Streamlit"],
      live: "amazon-rec-engine.vercel.app",
    },
    {
      title: "SatQuery AI: Satellite Imagery Q&A Assistant (SIH 2026)",
      short: "SatQuery AI",
      slug: "satquery",
      note: "github.com/TheOneAbovELL/SATQUERY",
      bullets: [
        "Built a vision-language assistant for ISRO's SIH problem statement 26167 that answers natural-language questions over optical, multispectral and SAR imagery using Qwen2-VL-2B-Instruct with a remote-sensing LoRA adapter.",
        "Routed each query to deterministic geospatial tools for the measurements, so the model interprets evidence but never invents numbers; every answer carries an auditable execution trace.",
      ],
      stack: ["Python", "FastAPI", "Qwen2-VL", "PEFT (LoRA)", "Rasterio", "Shapely", "NumPy", "SciPy", "Next.js"],
    },
  ] satisfies ResumeProject[],

  achievements: [
    "Codeforces Specialist – rating 1491 (C++), codeforces.com/profile/The0NEAboveALL.",
    "GirlScript Summer of Code 2026 – global rank 1,065 of 70,000+ registered contributors, 7 PRs merged.",
  ],

  skills: [
    {
      group: "Languages and Core CS",
      items: ["Python", "C++", "C", "TypeScript", "JavaScript", "SQL", "DSA", "OOP", "DBMS", "OS", "Computer Networks"],
    },
    {
      group: "AI / ML",
      items: ["PyTorch", "scikit-learn", "Hugging Face", "LangGraph", "RAG", "hybrid retrieval", "reranking", "vision-language models", "LoRA (PEFT)"],
    },
    {
      group: "Data and Geospatial",
      items: ["NumPy", "Pandas", "SciPy", "MNE-Python", "Rasterio", "Shapely", "Qdrant", "ChromaDB", "FAISS", "Neo4j", "MySQL"],
    },
    {
      group: "Backend and DevOps",
      items: ["FastAPI", "Pydantic", "AsyncIO", "SSE", "WebSockets", "React", "Next.js", "Docker", "GitHub Actions", "Pytest", "Playwright", "Git"],
    },
  ] satisfies ResumeSkillGroup[],
};

