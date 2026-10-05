/**
 * The Legal Lens request pipeline, as implemented in the repository's LangGraph graph and
 * `config/retrieval_profiles.json`. Drives the interactive pipeline figure.
 *
 * `detail` may vary by retrieval profile; a plain string applies to all three.
 */

export const PROFILES = [
  { id: "fast", label: "Simple", profile: "FAST" },
  { id: "balanced", label: "Moderate", profile: "BALANCED" },
  { id: "deep", label: "Complex", profile: "DEEP" },
] as const;

export type ProfileId = (typeof PROFILES)[number]["id"];

export interface PipelineStage {
  id: string;
  group: "Understand" | "Plan" | "Retrieve" | "Answer";
  name: string;
  description: string;
  /** A parameter that changes with the retrieval profile. */
  value?: Record<ProfileId, string>;
  /** The stage can end the request without an answer: it refuses, stops or rejects. */
  gate?: true;
}

export const PIPELINE: PipelineStage[] = [
  {
    id: "understand",
    group: "Understand",
    name: "Understand",
    description: "Normalise the query, extract entities, detect intent. Rule-based — no model call.",
  },
  {
    id: "safety",
    group: "Understand",
    name: "Safety gate",
    description: "Refuses advice, outcome prediction and prompt injection before anything is retrieved.",
    gate: true,
  },
  {
    id: "classify",
    group: "Understand",
    name: "Classify",
    description: "Scores query complexity and selects a retrieval profile.",
    value: { fast: "FAST", balanced: "BALANCED", deep: "DEEP" },
  },
  {
    id: "plan",
    group: "Plan",
    name: "Plan",
    description: "Decides what to search for.",
    value: { fast: "Single query", balanced: "Rule-based expansion", deep: "Up to 5 sub-queries" },
  },
  {
    id: "retrieve",
    group: "Retrieve",
    name: "Retrieve",
    description: "Dense, sparse and metadata search run concurrently, fused with weighted RRF.",
    value: { fast: "20 candidates", balanced: "30 + optional graph", deep: "40 + optional graph" },
  },
  {
    id: "rerank",
    group: "Retrieve",
    name: "Rerank",
    description: "Each candidate is scored against the sub-query it matched best.",
    value: { fast: "Top 6", balanced: "Top 10", deep: "Top 16" },
  },
  {
    id: "context",
    group: "Retrieve",
    name: "Build context",
    description: "De-duplicated, token-budgeted context. Every chunk gets a citation ID.",
    value: { fast: "1,800 tokens", balanced: "3,000 tokens", deep: "4,500 tokens" },
  },
  {
    id: "map",
    group: "Retrieve",
    name: "Map provisions",
    description: "Attaches IPC ↔ BNS mappings as citable entries.",
  },
  {
    id: "evidence",
    group: "Answer",
    name: "Evidence gate",
    description: "Weak evidence ends here with a fixed reply — the model is never called.",
    gate: true,
  },
  {
    id: "generate",
    group: "Answer",
    name: "Generate",
    description: "The answer streams token by token over SSE.",
  },
  {
    id: "validate",
    group: "Answer",
    name: "Validate citations",
    description: "Rejects unknown citation IDs, unseen section numbers and uncited answers.",
    gate: true,
  },
];
