/**
 * The Ask console's session: the queries asked in this tab and what became of each.
 *
 * A client hook with no rendering in it. State lives in the component that calls it and
 * nowhere else — nothing is written to storage, and the API is stateless — so closing the
 * tab ends the session. The hook also tells the race environment when a query is in flight.
 */

import { useEffect, useEffectEvent, useRef, useState } from "react";

import { race } from "@/components/race/store";

import { prepareQuestion, requestAnswer } from "./client";
import { ASK_LIMITS } from "./types";
import type { AskResponse, AskTurn } from "./types";

interface Asked {
  id: number;
  question: string;
}

/** One query and its outcome. */
export type Exchange =
  | (Asked & { state: "pending" })
  | (Asked & { state: "answered"; response: AskResponse })
  /** `retryAt` is an epoch time, set when the server said how long to wait. */
  | (Asked & { state: "failed"; message: string; retryAt: number | null });

export interface AskSession {
  /** Every query of the session, oldest first. */
  exchanges: Exchange[];
  /** The brief currently open. */
  active: Exchange | undefined;
  busy: boolean;
  /**
   * Increments whenever the visitor opens a brief (by asking or reopening), so the view can
   * move focus to it. It stays put when a pending brief merely receives its answer.
   */
  opened: number;
  /** Ask a question. Ignored while another is in flight or when there is too little to send. */
  ask: (raw: string) => void;
  /** Bring an earlier brief back without asking again. */
  reopen: (id: number) => void;
}

/** Earlier exchanges sent with a question so a follow-up keeps its subject. */
const HISTORY_EXCHANGES = ASK_LIMITS.historyMax / 2;

/**
 * The environment's sweep runs at least this long. Most answers come back within a few
 * milliseconds; the answer is shown the moment it arrives, but a light that has started to
 * travel is allowed to finish.
 */
const MIN_SWEEP_MS = 900;

function toHistory(exchanges: readonly Exchange[]): AskTurn[] {
  return exchanges
    .filter((exchange) => exchange.state === "answered")
    .slice(-HISTORY_EXCHANGES)
    .flatMap((exchange) => [
      { role: "user" as const, content: exchange.question },
      { role: "assistant" as const, content: exchange.response.answer.slice(0, ASK_LIMITS.historyContentMax) },
    ]);
}

export function useAskSession(): AskSession {
  const [exchanges, setExchanges] = useState<Exchange[]>([]);
  const [activeId, setActiveId] = useState<number | null>(null);
  const [opened, setOpened] = useState(0);

  const nextId = useRef(0);
  const request = useRef<AbortController | null>(null);
  const settle = useRef<ReturnType<typeof setTimeout> | null>(null);

  async function ask(raw: string): Promise<void> {
    const question = prepareQuestion(raw);
    // The ref, not state: two clicks in one frame would both read the same stale `busy`.
    if (!question || request.current) return;

    const id = (nextId.current += 1);
    const controller = new AbortController();
    request.current = controller;
    if (settle.current) clearTimeout(settle.current);
    // State the fact — a query is in flight — and let the environment decide how it looks.
    race.setActivity(1);
    const started = performance.now();

    setExchanges((current) => [...current, { id, question, state: "pending" }]);
    setActiveId(id);
    setOpened((count) => count + 1);

    const result = await requestAnswer(question, toHistory(exchanges), controller.signal);
    request.current = null;
    // Aborted means the console is gone; there is no state left to update.
    if (result.status === "aborted") return;

    settle.current = setTimeout(() => race.setActivity(0), Math.max(0, MIN_SWEEP_MS - (performance.now() - started)));
    const settled: Exchange =
      result.status === "answered"
        ? { id, question, state: "answered", response: result.response }
        : {
            id,
            question,
            state: "failed",
            message: result.message,
            retryAt: result.status === "rate_limited" ? Date.now() + result.retryAfter * 1000 : null,
          };
    setExchanges((current) => current.map((exchange) => (exchange.id === id ? settled : exchange)));
  }

  function reopen(id: number): void {
    setActiveId(id);
    setOpened((count) => count + 1);
  }

  // Leaving mid-query: cancel it and hand the environment back.
  const release = useEffectEvent(() => {
    request.current?.abort();
    request.current = null;
    if (settle.current) clearTimeout(settle.current);
    race.setActivity(0);
  });
  useEffect(() => () => release(), []);

  // Development only: /?ask=<question> runs that question on load, so an answered state can
  // be captured by tools that cannot interact with the page. Deferred a tick, so the double
  // mount of React's development mode schedules it once.
  const runPreset = useEffectEvent((question: string) => void ask(question));
  useEffect(() => {
    if (process.env.NODE_ENV === "production") return;
    const preset = new URLSearchParams(window.location.search).get("ask");
    if (!preset) return;
    const timer = setTimeout(() => runPreset(preset), 0);
    return () => clearTimeout(timer);
  }, []);

  return {
    exchanges,
    active: exchanges.find((exchange) => exchange.id === activeId),
    busy: exchanges.some((exchange) => exchange.state === "pending"),
    opened,
    ask: (raw) => void ask(raw),
    reopen,
  };
}
