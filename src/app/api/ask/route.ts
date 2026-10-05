import { answerQuestion } from "@/lib/ask/answer";
import { checkRateLimit, clientKey } from "@/lib/ask/ratelimit";
import { parseAskRequest, readLimitedBody } from "@/lib/ask/request";
import type { AskErrorResponse, AskResponse } from "@/lib/ask/types";

/**
 * POST /api/ask — the portfolio assistant.
 *
 * Stateless: the client sends the recent turns with each request and nothing is stored.
 * Question text is never logged. Only POST is exported, so other methods receive 405.
 */

// The Anthropic SDK and the in-memory rate limiter need the Node.js runtime.
export const runtime = "nodejs";

const NO_STORE = { "Cache-Control": "no-store" } as const;

const UNAVAILABLE: AskErrorResponse = {
  error: "unavailable",
  message:
    "The portfolio assistant is temporarily unavailable. You can still explore the projects, research and experience directly.",
};

function json(body: AskResponse | AskErrorResponse, status: number, headers: Record<string, string> = {}): Response {
  return Response.json(body, { status, headers: { ...NO_STORE, ...headers } });
}

const invalidRequest = (message: string): Response => json({ error: "invalid_request", message }, 400);

export async function POST(request: Request): Promise<Response> {
  try {
    // Validation comes before the rate limit. A malformed request is always told what is
    // wrong with it (400, never a 429 that hides the real problem), and it does not spend the
    // visitor's allowance: the limit meters answers, and refusing a bad body costs at most a
    // 16 KB read and one JSON.parse.
    const contentType = request.headers.get("content-type") ?? "";
    if (!contentType.toLowerCase().includes("application/json")) {
      return invalidRequest("Send the question as JSON with a Content-Type of application/json.");
    }

    const bodyText = await readLimitedBody(request);
    if (bodyText === null) return invalidRequest("The request body is too large.");

    const parsed = parseAskRequest(bodyText);
    if (!parsed.ok) return invalidRequest(parsed.message);

    const limit = checkRateLimit(clientKey(request.headers));
    if (!limit.allowed) {
      // Say which limit was hit: "wait a few seconds" and "come back later" are different asks.
      const message =
        limit.window === "minute"
          ? `Too many questions in a short time. Please try again in ${limit.retryAfter} seconds.`
          : `The hourly question limit has been reached. Please try again in about ${Math.ceil(limit.retryAfter / 60)} minutes.`;
      return json({ error: "rate_limited", message, retryAfter: limit.retryAfter }, 429, {
        "Retry-After": String(limit.retryAfter),
      });
    }

    const { question, history } = parsed.value;
    return json(await answerQuestion(question, history), 200);
  } catch (error) {
    // Provider failures never reach here (they degrade to a fallback answer); this is for
    // genuinely unexpected faults. Log the error type only — never the question.
    console.error(`[ask] unexpected failure: ${error instanceof Error ? error.name : "unknown"}`);
    return json(UNAVAILABLE, 503);
  }
}
