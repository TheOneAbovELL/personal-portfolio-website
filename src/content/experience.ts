import type { Education, Experience } from "./types";

const NYAY_SETU = "https://github.com/viru0909-dev/nyay-setu-working/pull";

/**
 * Roles and contributions, newest first. Supports internships, research roles, open-source
 * work, freelance and full-time roles alike — set `kind` and the UI labels it.
 * Use `end: null` for anything ongoing.
 */
export const experience: Experience[] = [
  {
    id: "bit-mesra-ura",
    organization: "Birla Institute of Technology, Mesra",
    unit: "Department of Computer Science",
    role: "Undergraduate Research Assistant",
    kind: "research",
    start: "2026-01",
    end: null,
    summary:
      "Designing and building Legal Lens, an evidence-grounded legal research system for Indian law.",
    highlights: [
      {
        text: "Designed the retrieval pipeline as a LangGraph graph: complexity-based routing, multi-source hybrid retrieval with weighted rank fusion, and citation validation.",
      },
      {
        text: "Built the FastAPI backend — SSE streaming with typed events, authentication, persisted conversations — with an offline test suite and CI.",
      },
      {
        text: "Set up an evaluation harness (Recall@K, MRR, nDCG, citation validity) to compare chunking and reranking strategies.",
      },
    ],
    stack: ["Python", "FastAPI", "LangGraph", "Qdrant", "Docker", "GitHub Actions"],
    projects: ["legal-lens"],
  },
  {
    id: "gssoc-2026",
    organization: "GirlScript Summer of Code 2026",
    unit: "Nyay Setu — digital judiciary platform",
    role: "Open-source contributor",
    kind: "open-source",
    start: "2026-05",
    end: null,
    summary:
      "Contributed reliability and validation features to the AI layer of an open-source legal platform. Seven pull requests merged.",
    highlights: [
      {
        text: "Provider retry and fallback for the NLP orchestrator, so a failing model provider no longer fails the request.",
        links: [{ label: "#778", href: `${NYAY_SETU}/778` }],
      },
      {
        text: "A legal-citation verification layer for model responses, plus BNS and BNSS section-range rules for its validation dataset.",
        links: [
          { label: "#484", href: `${NYAY_SETU}/484` },
          { label: "#561", href: `${NYAY_SETU}/561` },
        ],
      },
      {
        text: "Streaming token responses and a caching layer for repeated NLP requests.",
        links: [
          { label: "#507", href: `${NYAY_SETU}/507` },
          { label: "#406", href: `${NYAY_SETU}/406` },
        ],
      },
      {
        text: "IP-based rate limiting on authentication endpoints, and a legal document auto-generator.",
        links: [
          { label: "#222", href: `${NYAY_SETU}/222` },
          { label: "#582", href: `${NYAY_SETU}/582` },
        ],
      },
    ],
    stack: ["Python", "FastAPI", "Pytest", "Docker", "GitHub Actions"],
  },
];

export const education: Education[] = [
  {
    id: "bit-mesra",
    institution: "Birla Institute of Technology, Mesra",
    degree: "Bachelor of Technology",
    field: "Artificial Intelligence and Machine Learning",
    start: "2024-08",
    end: null,
  },
  {
    id: "iit-madras",
    institution: "Indian Institute of Technology, Madras",
    degree: "Bachelor of Science",
    field: "Data Science and Applications",
    start: "2025-01",
    end: null,
  },
];
