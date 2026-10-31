/**
 * Shared types for "Ask Omjee", the grounded portfolio assistant.
 *
 * This module has no server-only imports, so client components can import from it freely.
 */

export type KnowledgeType =
  | "profile"
  | "philosophy"
  | "skill"
  | "project"
  | "case-study"
  | "experience"
  | "education"
  | "achievement"
  | "now"
  | "repo"
  | "contact"
  | "resume";

/** One retrievable unit of portfolio content, derived from `src/content/*`. */
export interface KnowledgeDoc {
  id: string;
  type: KnowledgeType;
  title: string;
  /** How the document is cited to visitors, e.g. "Legal Lens / Decisions". */
  label: string;
  text: string;
  tags: string[];
  /** A real route or an external URL that already appears in the content. */
  href: string;
  /** Ranking multiplier; 1 is neutral. */
  importance: number;
  /** The project or repository this document belongs to, e.g. "project:legal-lens". */
  entity?: string;
}

export type AskRole = "user" | "assistant";

export interface AskTurn {
  role: AskRole;
  content: string;
}

export interface AskRequest {
  question: string;
  history?: AskTurn[];
}

/**
 * - `direct`   — composed from the content by an intent rule; no model call.
 * - `llm`      — written by the model from retrieved excerpts.
 * - `fallback` — extractive answer used when no model is configured or the call failed.
 */
export type AskMode = "direct" | "llm" | "fallback";

export interface AskSource {
  label: string;
  href: string;
  type: KnowledgeType;
}

export interface AskCard {
  kind: "project" | "repo" | "experience" | "skill";
  title: string;
  subtitle?: string;
  href: string;
  tags?: string[];
  /** A project's status as the site labels it, e.g. "Research prototype". */
  status?: string;
}

/** A figure counted from the content or fetched with it — never an estimate. */
export interface AskStat {
  /** Preformatted for display, e.g. "03". */
  value: string;
  label: string;
}

/** Where to go next: a route on this site or a URL that already appears in the content. */
export interface AskAction {
  label: string;
  href: string;
}

export interface AskResponse {
  /** Plain text, paragraphs separated by "\n\n", no markdown. */
  answer: string;
  mode: AskMode;
  sources: AskSource[];
  cards: AskCard[];
  followUps: string[];
  /** Counts that summarise the answer. Omitted when the answer has none. */
  stats?: AskStat[];
  /** Technologies and concepts the answer touches, from a project stack or a skill domain. */
  related?: string[];
  /** Links that continue from the answer into the site. */
  actions?: AskAction[];
}

export type AskErrorCode = "invalid_request" | "rate_limited" | "unavailable";

export interface AskErrorResponse {
  error: AskErrorCode;
  message: string;
  /** Seconds until the next request is allowed. Present only for `rate_limited`. */
  retryAfter?: number;
}

/** Request limits enforced by the API; exported so the UI can mirror them. */
export const ASK_LIMITS = {
  questionMin: 2,
  questionMax: 400,
  historyMax: 6,
  historyContentMax: 800,
} as const;

export const ASK_ENDPOINT = "/api/ask";
