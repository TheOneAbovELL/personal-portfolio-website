/**
 * Browser side of POST /api/ask.
 *
 * Every way the request can end — an answer, a rate limit, a refusal, a timeout, an offline
 * device, a proxy returning HTML — is folded into one result type, so the console renders a
 * state instead of catching exceptions. No server-only imports: safe in a client component.
 */

import { ASK_ENDPOINT, ASK_LIMITS } from "./types";
import type { AskErrorResponse, AskResponse, AskTurn } from "./types";

export type AskResult =
  | { status: "answered"; response: AskResponse }
  /** `retryAfter` is the server's own figure, in seconds. */
  | { status: "rate_limited"; message: string; retryAfter: number }
  | { status: "failed"; message: string }
  /** The caller cancelled (the console unmounted); there is nothing to show. */
  | { status: "aborted" };

/** A visitor is waiting: longer than the server's own model deadline, short enough to give up. */
const TIMEOUT_MS = 20_000;
/** Used when a 429 arrives without a usable `retryAfter`. */
const DEFAULT_RETRY_SECONDS = 60;

const UNAVAILABLE = "The guide could not be reached just now. Everything it draws on is still on this page.";
const RATE_LIMITED = "Too many questions in a short time.";
const UNREADABLE = "That question could not be read. Try asking it again in a plain sentence.";

const isRecord = (value: unknown): value is Record<string, unknown> => typeof value === "object" && value !== null;

/** Enough of a shape check that rendering the answer can never throw on a malformed payload. */
function isAskResponse(value: unknown): value is AskResponse {
  return (
    isRecord(value) &&
    typeof value.answer === "string" &&
    value.answer.length > 0 &&
    (value.mode === "direct" || value.mode === "llm" || value.mode === "fallback") &&
    Array.isArray(value.sources) &&
    Array.isArray(value.cards) &&
    Array.isArray(value.followUps)
  );
}

const isAskError = (value: unknown): value is AskErrorResponse => isRecord(value) && typeof value.error === "string" && typeof value.message === "string";

/** Trim a question to what the API accepts, or null when there is too little to send. */
export function prepareQuestion(raw: string): string | null {
  const question = raw.replace(/\s+/g, " ").trim().slice(0, ASK_LIMITS.questionMax);
  return question.length >= ASK_LIMITS.questionMin ? question : null;
}

/**
 * Ask one question. `history` is the recent conversation, oldest first; `signal` cancels the
 * request. Never rejects.
 */
export async function requestAnswer(question: string, history: readonly AskTurn[], signal?: AbortSignal): Promise<AskResult> {
  // One controller covers both the caller's cancellation and the deadline.
  const controller = new AbortController();
  const cancel = () => controller.abort();
  const deadline = setTimeout(cancel, TIMEOUT_MS);
  signal?.addEventListener("abort", cancel, { once: true });

  try {
    const response = await fetch(ASK_ENDPOINT, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ question, history }),
      signal: controller.signal,
    });
    const body: unknown = await response.json().catch(() => null);

    if (response.ok) return isAskResponse(body) ? { status: "answered", response: body } : { status: "failed", message: UNAVAILABLE };
    if (response.status === 429) {
      const seconds = isAskError(body) && typeof body.retryAfter === "number" && body.retryAfter > 0 ? body.retryAfter : DEFAULT_RETRY_SECONDS;
      return { status: "rate_limited", message: RATE_LIMITED, retryAfter: Math.ceil(seconds) };
    }
    // A 400 means the question itself was refused (the API's own message is written for
    // developers); anything else is the service's problem.
    return { status: "failed", message: response.status === 400 ? UNREADABLE : UNAVAILABLE };
  } catch {
    return signal?.aborted ? { status: "aborted" } : { status: "failed", message: UNAVAILABLE };
  } finally {
    clearTimeout(deadline);
    signal?.removeEventListener("abort", cancel);
  }
}
