/**
 * Parsing and validation for POST /api/ask.
 */

import { ASK_LIMITS } from "./types";
import type { AskRequest, AskTurn } from "./types";

/** Generous for a 400-character question plus six short turns, small enough to refuse abuse. */
export const MAX_BODY_BYTES = 16 * 1024;

export type ParseResult = { ok: true; value: Required<AskRequest> } | { ok: false; message: string };

const invalid = (message: string): ParseResult => ({ ok: false, message });

/** Read the body as text, giving up as soon as it exceeds the size cap. */
export async function readLimitedBody(request: Request): Promise<string | null> {
  const declared = Number(request.headers.get("content-length"));
  if (Number.isFinite(declared) && declared > MAX_BODY_BYTES) return null;
  if (!request.body) return "";

  const reader = request.body.getReader();
  const decoder = new TextDecoder();
  let received = 0;
  let text = "";
  for (;;) {
    const { done, value } = await reader.read();
    if (done) break;
    received += value.byteLength;
    if (received > MAX_BODY_BYTES) {
      await reader.cancel();
      return null;
    }
    text += decoder.decode(value, { stream: true });
  }
  return text + decoder.decode();
}

const isRecord = (value: unknown): value is Record<string, unknown> =>
  typeof value === "object" && value !== null && !Array.isArray(value);

/** Collapse whitespace and drop control characters. */
const tidy = (text: string): string => text.replace(/[\u0000-\u001f\u007f]+/g, " ").replace(/\s+/g, " ").trim();

function parseHistory(raw: unknown): AskTurn[] | null {
  if (raw === undefined || raw === null) return [];
  if (!Array.isArray(raw)) return null;

  const turns: AskTurn[] = [];
  for (const item of raw) {
    // Malformed turns are dropped rather than failing the request: history is only context.
    if (!isRecord(item) || typeof item.content !== "string") continue;
    if (item.role !== "user" && item.role !== "assistant") continue;
    const content = tidy(item.content).slice(0, ASK_LIMITS.historyContentMax);
    if (content) turns.push({ role: item.role, content });
  }
  return turns.slice(-ASK_LIMITS.historyMax);
}

export function parseAskRequest(bodyText: string): ParseResult {
  let body: unknown;
  try {
    body = JSON.parse(bodyText);
  } catch {
    return invalid("The request body must be valid JSON.");
  }
  if (!isRecord(body)) return invalid("The request body must be a JSON object.");
  if (typeof body.question !== "string") return invalid("`question` must be a string.");

  const question = tidy(body.question);
  if (question.length < ASK_LIMITS.questionMin || question.length > ASK_LIMITS.questionMax) {
    return invalid(`\`question\` must be between ${ASK_LIMITS.questionMin} and ${ASK_LIMITS.questionMax} characters.`);
  }

  const history = parseHistory(body.history);
  if (history === null) return invalid("`history` must be an array of { role, content } turns.");

  return { ok: true, value: { question, history } };
}
