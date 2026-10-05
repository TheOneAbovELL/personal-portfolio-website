/**
 * Best-effort sliding-window rate limiter, keyed by client IP.
 *
 * Two windows apply at once: a short one against bursts and a long one against sustained use.
 * Only requests that were let through are recorded, so a client that keeps retrying while
 * blocked does not extend its own block. The route validates a request before it asks here,
 * so malformed requests are answered with 400 and never count against the allowance.
 *
 * Honest limits of this approach: the counters live in this process's memory. On serverless
 * hosting each instance keeps its own map and a cold start resets it, so a determined client
 * spread across instances can exceed these numbers. It stops casual abuse and accidental
 * loops, nothing more. The durable options are a shared store (Upstash Redis / Vercel KV)
 * behind the same `checkRateLimit` signature, or rate-limit rules in the Vercel Firewall.
 */

const MINUTE_MS = 60_000;
const HOUR_MS = 3_600_000;
const DEFAULT_PER_MINUTE = 8;
const DEFAULT_PER_HOUR = 40;

const CLEANUP_INTERVAL_MS = 5 * MINUTE_MS;
/** Upper bound on tracked clients, so a flood of spoofed addresses cannot grow memory unbounded. */
const MAX_CLIENTS = 5_000;

export type RateLimitWindow = "minute" | "hour";

export type RateLimitResult = { allowed: true } | { allowed: false; retryAfter: number; window: RateLimitWindow };

/** Request timestamps per client, oldest first. Only allowed requests are stored. */
const requests = new Map<string, number[]>();
let lastCleanup = 0;

function configuredLimit(name: string, fallback: number): number {
  const value = Number(process.env[name]);
  return Number.isInteger(value) && value > 0 ? value : fallback;
}

/**
 * The limits in force. Overridable per environment so the hourly cap can be raised while
 * testing locally, where every request comes from the same address.
 */
function windows(): { name: RateLimitWindow; ms: number; limit: number }[] {
  return [
    { name: "minute", ms: MINUTE_MS, limit: configuredLimit("ASK_RATE_LIMIT_PER_MINUTE", DEFAULT_PER_MINUTE) },
    { name: "hour", ms: HOUR_MS, limit: configuredLimit("ASK_RATE_LIMIT_PER_HOUR", DEFAULT_PER_HOUR) },
  ];
}

function cleanup(now: number): void {
  lastCleanup = now;
  for (const [key, timestamps] of requests) {
    if (timestamps.length === 0 || now - timestamps[timestamps.length - 1] >= HOUR_MS) requests.delete(key);
  }
  // Still over the cap: drop the clients seen longest ago (Map iterates in insertion order).
  for (const key of requests.keys()) {
    if (requests.size <= MAX_CLIENTS) break;
    requests.delete(key);
  }
}

/**
 * Decide whether a request from `key` may proceed, and record it if so.
 * `now` is injectable so the sliding behaviour can be checked without waiting.
 */
export function checkRateLimit(key: string, now: number = Date.now()): RateLimitResult {
  if (now - lastCleanup >= CLEANUP_INTERVAL_MS || requests.size > MAX_CLIENTS) cleanup(now);

  // Drop everything older than the longest window; what remains is this client's live history.
  const recent = (requests.get(key) ?? []).filter((timestamp) => now - timestamp < HOUR_MS);

  let blocked: { retryAfterMs: number; window: RateLimitWindow } | null = null;
  for (const { name, ms, limit } of windows()) {
    const inWindow = recent.filter((timestamp) => now - timestamp < ms);
    if (inWindow.length < limit) continue;
    // Allowed again once enough of the oldest requests have aged out of this window.
    const retryAfterMs = inWindow[inWindow.length - limit] + ms - now;
    if (!blocked || retryAfterMs > blocked.retryAfterMs) blocked = { retryAfterMs, window: name };
  }

  if (blocked) {
    // Not recorded: a rejected request must not push the block further into the future.
    requests.set(key, recent);
    return { allowed: false, retryAfter: Math.max(1, Math.ceil(blocked.retryAfterMs / 1000)), window: blocked.window };
  }

  recent.push(now);
  // Re-insert so the Map's order tracks recency, which the cap in `cleanup` relies on.
  requests.delete(key);
  requests.set(key, recent);
  return { allowed: true };
}

/**
 * The client's address as reported by the hosting proxy: the first hop of `x-forwarded-for`.
 * The header is only trustworthy behind a proxy that sets it (Vercel does); requests without
 * one — typically local development — share a single bucket.
 */
export function clientKey(headers: Headers): string {
  const forwarded = headers.get("x-forwarded-for")?.split(",")[0]?.trim();
  const address = forwarded || headers.get("x-real-ip")?.trim() || "unknown";
  return address.slice(0, 64);
}
