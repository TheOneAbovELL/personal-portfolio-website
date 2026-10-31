"use client";

import Link from "next/link";
import { Fragment, useEffect, useId, useRef, useState } from "react";
import type { CSSProperties, KeyboardEvent, ReactNode, RefObject } from "react";
import { ASK_EVENT, takePendingQuestion } from "@/components/nav/events";
import { Icon } from "@/components/ui/Icon";
import { prepareQuestion } from "@/lib/ask/client";
import { useAskSession } from "@/lib/ask/session";
import type { Exchange } from "@/lib/ask/session";
import type { SuggestionGroup } from "@/lib/ask/suggestions";
import { ASK_LIMITS } from "@/lib/ask/types";
import type { AskCard, AskMode, AskResponse } from "@/lib/ask/types";
import { prefersReducedMotion } from "@/lib/motion";

const MODE_LABEL: Record<AskMode, string> = {
  direct: "From portfolio data",
  llm: "Synthesised from sources",
  fallback: "Extract from sources",
};

const statusOf = (exchange: Exchange): string =>
  exchange.state === "pending" ? "Retrieving" : exchange.state === "answered" ? MODE_LABEL[exchange.response.mode] : "No response";

/** Where a visitor can go when the guide cannot answer. */
const KEEP_MOVING = [
  { label: "Work", href: "/#work" },
  { label: "Research", href: "/#research" },
  { label: "Experience", href: "/#experience" },
  { label: "Garage", href: "/#garage" },
];

/** Label gutter + content: every row of the console shares these two columns. */
const COLUMNS = "md:grid-cols-[11rem_minmax(0,1fr)]";
const GUTTER = "label px-5 pt-5 text-faint md:border-r md:border-rule md:px-6 md:py-5";
const CELL = "min-w-0 px-5 pb-5 pt-2.5 md:px-6 md:py-5";

const pad = (value: number) => String(value).padStart(2, "0");

/* ------------------------------------------------------------------------------ parts */

const isExternal = (href: string) => /^(https?:|mailto:)/.test(href) || href.endsWith(".pdf");

/** Routes on this site use the router; everything else opens in a new tab. */
function SmartLink({ href, className, children }: { href: string; className?: string; children: ReactNode }) {
  if (!isExternal(href)) {
    return (
      <Link href={href} className={className}>
        {children}
      </Link>
    );
  }
  const newTab = !href.startsWith("mailto:");
  return (
    <a href={href} className={className} {...(newTab ? { target: "_blank", rel: "noopener noreferrer" } : {})}>
      {children}
    </a>
  );
}

/** A destination: the arrow moves and the link warms to champagne, as navigation does across the site. */
function ArrowLink({ href, children }: { href: string; children: ReactNode }) {
  return (
    <SmartLink
      href={href}
      className="group inline-flex min-h-11 items-center gap-2 text-[0.9375rem] font-medium tracking-[-0.01em] text-bone transition-colors duration-300 hover:text-champagne-bright"
    >
      {children}
      <Icon
        name={isExternal(href) ? "arrow-up-right" : "arrow-right"}
        size={14}
        className="text-champagne transition-[transform,color] duration-300 ease-[var(--ease-soft)] group-hover:translate-x-1 group-hover:text-champagne-bright"
      />
    </SmartLink>
  );
}

const LINKABLE = /(https:\/\/[^\s"”)]*[^\s"”).,;:]|[\w.+-]+@[\w-]+(?:\.[\w-]+)+)/g;

/** Answers are plain text; a URL or an email address the content states becomes a link. */
function linked(text: string): ReactNode[] {
  return text.split(LINKABLE).map((part, index) =>
    index % 2 === 1 ? (
      <SmartLink key={index} href={part.includes("://") ? part : `mailto:${part}`} className="link-underline break-words text-bone hover:text-champagne-bright">
        {part}
      </SmartLink>
    ) : (
      <Fragment key={index}>{part}</Fragment>
    ),
  );
}

/** "Note: …" and "Note on <project>: …" are caveats the answer must carry; they are set apart. */
const CAVEAT = /^(Note(?: on [^:]{1,60})?):\s*/;

function Paragraph({ text }: { text: string }) {
  const caveat = CAVEAT.exec(text);
  if (!caveat) return <p className="text-[1.0625rem] leading-[1.65] text-bone/95">{linked(text)}</p>;
  return (
    <p className="border-l border-rule-strong pl-4 text-[0.9375rem] leading-relaxed text-steel">
      <span className="label mr-2.5 text-faint">{caveat[1]}</span>
      {text.slice(caveat[0].length)}
    </p>
  );
}

/** One row of a brief: its name in the gutter, its content beside it. Rows print in sequence. */
function Row({ label, order, children }: { label: string; order: number; children: ReactNode }) {
  return (
    <div className={`ask-row grid border-t border-rule ${COLUMNS}`} style={{ "--row": order } as CSSProperties}>
      <dt className={GUTTER}>{label}</dt>
      <dd className={CELL}>{children}</dd>
    </div>
  );
}

/** A question that can be asked with one press. The marker grows and turns rosso under the pointer. */
function QuestionButton({ question, onAsk, order }: { question: string; onAsk: (question: string) => void; order: number }) {
  return (
    <button
      type="button"
      onClick={() => onAsk(question)}
      className="ask-snap group flex min-h-12 w-full items-center gap-3 py-2 text-left text-[0.9875rem] leading-snug text-steel transition-colors duration-[var(--dur-fast)] hover:text-bone focus-visible:text-bone"
      style={{ "--row": order } as CSSProperties}
    >
      <span
        aria-hidden="true"
        className="h-px w-3 shrink-0 rounded-pill bg-metal-3 transition-[width,background-color] duration-[360ms] ease-[var(--ease-soft)] group-hover:w-6 group-hover:bg-rosso-bright group-focus-visible:w-6 group-focus-visible:bg-rosso-bright"
      />
      {question}
    </button>
  );
}

/** Evidence as a ledger: one numbered row per case study, repository, role or capability. */
function EvidenceRow({ card, number }: { card: AskCard; number: number }) {
  return (
    <li className="group relative isolate grid grid-cols-[2.5rem_minmax(0,1fr)_1rem] items-baseline gap-x-3 border-b border-rule py-3.5 last:border-b-0 sm:grid-cols-[3rem_minmax(0,1fr)_1rem]">
      {/* The row lifts on hover: a soft rounded fill, like a selected row on a timing screen. */}
      <span
        aria-hidden="true"
        className="absolute -inset-x-3 inset-y-1 -z-10 rounded-md bg-bone/[0.045] opacity-0 transition-opacity duration-300 ease-[var(--ease-soft)] group-hover:opacity-100"
      />
      <span aria-hidden="true" className="readout text-[0.75rem] text-faint transition-colors duration-[var(--dur-fast)] group-hover:text-rosso-bright">
        E.{pad(number)}
      </span>
      <div className="min-w-0">
        <p className="label flex flex-wrap gap-x-2 text-faint">
          {card.kind}
          {card.status && (
            <>
              <span aria-hidden="true" className="text-metal-3">
                /
              </span>
              <span className="text-steel">{card.status}</span>
            </>
          )}
        </p>
        <h4 className="mt-1 text-[1.0625rem] font-medium leading-snug text-bone">
          <SmartLink href={card.href} className="transition-colors duration-[var(--dur-fast)] after:absolute after:inset-0 group-hover:text-champagne-bright">
            {card.title}
          </SmartLink>
        </h4>
        {card.subtitle && <p className="mt-1 max-w-[40rem] text-[0.875rem] leading-snug text-steel">{card.subtitle}</p>}
        {card.tags && card.tags.length > 0 && <p className="label mt-2 text-[0.625rem] text-faint">{card.tags.join(" · ")}</p>}
      </div>
      <Icon
        name={isExternal(card.href) ? "arrow-up-right" : "arrow-right"}
        size={14}
        className="self-center text-faint transition-[transform,color] duration-[220ms] ease-[var(--ease-snap)] group-hover:translate-x-0.5 group-hover:text-champagne-bright"
      />
    </li>
  );
}

const secondsUntil = (deadline: number | null): number => (deadline === null ? 0 : Math.max(0, Math.ceil((deadline - Date.now()) / 1000)));

/** Whole seconds until `deadline` (an epoch time), ticking while it is in the future. */
function useSecondsUntil(deadline: number | null): number {
  const [seconds, setSeconds] = useState(() => secondsUntil(deadline));
  useEffect(() => {
    if (deadline === null) return;
    const timer = setInterval(() => {
      const left = secondsUntil(deadline);
      setSeconds(left);
      if (left === 0) clearInterval(timer);
    }, 500);
    return () => clearInterval(timer);
  }, [deadline]);
  return seconds;
}

/* ------------------------------------------------------------------------------ brief */

/** Everything a brief carries beyond the response itself. Each row appears only when it has content. */
function AnsweredRows({ response, onAsk }: { response: AskResponse; onAsk: (question: string) => void }) {
  const { stats = [], related = [], actions = [], cards, sources, followUps } = response;
  const rows: { label: string; content: ReactNode }[] = [];

  if (stats.length > 0) {
    rows.push({
      label: "Readout",
      content: (
        <dl className="flex flex-wrap gap-x-10 gap-y-5">
          {stats.map((stat) => (
            <div key={stat.label} className="flex flex-col-reverse border-l border-rule-strong pl-4">
              <dt className="label mt-2 text-steel">{stat.label}</dt>
              <dd className="readout text-[clamp(2rem,3.4vw,2.75rem)] leading-none text-bone">{stat.value}</dd>
            </div>
          ))}
        </dl>
      ),
    });
  }

  if (related.length > 0) {
    rows.push({
      label: "Related systems",
      content: (
        <ul className="flex flex-wrap gap-1.5">
          {related.map((item) => (
            <li key={item} className="label rounded-xs border border-bone/[0.07] bg-bone/[0.04] px-2 py-1 tracking-[0.08em] text-steel">
              {item}
            </li>
          ))}
        </ul>
      ),
    });
  }

  if (cards.length > 0 || sources.length > 0) {
    rows.push({
      label: "Evidence",
      content: (
        <>
          {cards.length > 0 && (
            <ul className="-mt-3.5">
              {cards.map((card, index) => (
                <EvidenceRow key={`${card.kind}-${card.href}-${card.title}`} card={card} number={index + 1} />
              ))}
            </ul>
          )}
          {sources.length > 0 && (
            <div className={`flex flex-wrap items-baseline gap-x-5 gap-y-1.5 ${cards.length > 0 ? "border-t border-rule pt-4" : ""}`}>
              <p className="label text-faint">Sources</p>
              <ul className="flex flex-wrap items-baseline gap-x-5 gap-y-1.5">
                {sources.map((source) => (
                  <li key={`${source.href}-${source.label}`}>
                    <SmartLink href={source.href} className="label link-underline text-champagne hover:text-bone">
                      {source.label}
                    </SmartLink>
                  </li>
                ))}
              </ul>
            </div>
          )}
        </>
      ),
    });
  }

  if (actions.length > 0) {
    rows.push({
      label: "Go to",
      content: (
        <ul className="-my-2.5 flex flex-wrap gap-x-8">
          {actions.map((action) => (
            <li key={`${action.href}-${action.label}`}>
              <ArrowLink href={action.href}>{action.label}</ArrowLink>
            </li>
          ))}
        </ul>
      ),
    });
  }

  if (followUps.length > 0) {
    rows.push({
      label: "Ask next",
      content: (
        <ul className="-my-2.5 grid gap-x-10 lg:grid-cols-2">
          {followUps.map((followUp, index) => (
            <li key={followUp}>
              <QuestionButton question={followUp} onAsk={onAsk} order={index} />
            </li>
          ))}
        </ul>
      ),
    });
  }

  return rows.map((row, index) => (
    <Row key={row.label} label={row.label} order={index + 1}>
      {row.content}
    </Row>
  ));
}

/** Ask the same question again — once the server's own wait, if it gave one, has run out. */
function Retry({ exchange, onAsk }: { exchange: Extract<Exchange, { state: "failed" }>; onAsk: (question: string) => void }) {
  const seconds = useSecondsUntil(exchange.retryAt);
  return (
    <div className="mt-4 flex flex-wrap items-center gap-x-6 gap-y-2">
      <button
        type="button"
        disabled={seconds > 0}
        onClick={() => onAsk(exchange.question)}
        className="inline-flex min-h-11 items-center rounded-pill border border-bone/[0.14] bg-bone/[0.04] px-5 text-[0.9375rem] font-medium text-bone transition-colors duration-300 enabled:hover:border-bone/[0.3] enabled:hover:bg-bone/[0.08] disabled:text-faint"
      >
        Ask again
      </button>
      {seconds > 0 && (
        <p className="label text-steel">
          Ready in <span className="readout text-bone">{seconds}</span> s
        </p>
      )}
    </div>
  );
}

interface BriefProps {
  exchange: Exchange;
  /** Position in the session, from 1. */
  number: number;
  headingRef: RefObject<HTMLHeadingElement | null>;
  onAsk: (question: string) => void;
}

/** The response to one query, laid out as a brief rather than a message. */
function Brief({ exchange, number, headingRef, onAsk }: BriefProps) {
  const headingId = useId();
  const { state } = exchange;

  return (
    <article aria-labelledby={headingId} aria-busy={state === "pending"} className="scroll-mt-28 border-t border-rule-strong">
      <header className="flex items-center justify-between gap-4 bg-bone/[0.025] px-5 py-3 md:px-6">
        <p className="label text-steel">
          <span className="text-champagne">Brief</span>
          <span className="readout ml-2">{pad(number)}</span>
        </p>
        <p className="label flex items-center gap-2 text-right text-steel">
          <span aria-hidden="true" className={`size-1.5 shrink-0 rounded-pill ${state === "failed" ? "border border-steel" : state === "pending" ? "pulse-dot bg-rosso-bright" : "bg-champagne"}`} />
          {statusOf(exchange)}
        </p>
      </header>

      <dl>
        <Row label="Query" order={0}>
          <h3
            id={headingId}
            ref={headingRef}
            tabIndex={-1}
            className="max-w-[44rem] text-[clamp(1.1875rem,1.7vw,1.4375rem)] font-medium leading-snug text-bone focus:outline-none"
          >
            {exchange.question}
          </h3>
        </Row>

        <Row label={state === "failed" ? "Status" : "System response"} order={1}>
          {/* One live region for the life of the brief: it exists before the answer does, so
              the answer is announced when it lands instead of arriving unannounced. */}
          <div aria-live="polite" className="max-w-[44rem]">
            {state === "pending" && (
              <>
                <div aria-hidden="true" className="ask-trace scale-ticks mt-2 max-w-[28rem]">
                  <i />
                </div>
                <p className="label mt-3 text-steel">Retrieving from the portfolio index</p>
              </>
            )}
            {state === "answered" && (
              <div className="ask-print space-y-4">
                {exchange.response.answer.split(/\n{2,}/).map((paragraph, index) => (
                  <Paragraph key={index} text={paragraph} />
                ))}
              </div>
            )}
            {state === "failed" && <p className="ask-print text-[1.0625rem] leading-relaxed text-bone/95">{exchange.message}</p>}
          </div>
          {state === "failed" && <Retry exchange={exchange} onAsk={onAsk} />}
        </Row>

        {state === "answered" && <AnsweredRows response={exchange.response} onAsk={onAsk} />}
        {state === "failed" && (
          <Row label="Keep moving" order={1}>
            <ul className="-my-2.5 flex flex-wrap gap-x-8">
              {KEEP_MOVING.map((link) => (
                <li key={link.href}>
                  <ArrowLink href={link.href}>{link.label}</ArrowLink>
                </li>
              ))}
            </ul>
          </Row>
        )}
      </dl>
    </article>
  );
}

/* ---------------------------------------------------------------------------- console */

/** How much of a newly opened brief must be on screen before the page is moved to show it. */
const MIN_BRIEF_IN_VIEW = 140;

/**
 * Bring a brief into view without taking the visitor away from the controls they just used:
 * the page moves only when the brief starts off-screen, and then only far enough to read it.
 */
function showBrief(heading: HTMLElement): void {
  const article = heading.closest("article");
  if (!article) return;
  const { top } = article.getBoundingClientRect();
  const behavior: ScrollBehavior = prefersReducedMotion() ? "auto" : "smooth";
  if (top < 0) article.scrollIntoView({ block: "start", behavior });
  else if (window.innerHeight - top < MIN_BRIEF_IN_VIEW) window.scrollBy({ top: top - window.innerHeight * 0.55, behavior });
}

/**
 * Ask Omjee — a briefing console over the portfolio's own content.
 *
 * A query is entered like a command, or chosen from a topic; what comes back is a structured
 * brief: the response, the figures behind it, related systems, evidence that navigates, and
 * where to go next. One brief is open at a time; earlier ones wait in a session log.
 */
export function AskConsole({ groups }: { groups: SuggestionGroup[] }) {
  const { exchanges, active, busy, opened, ask, reopen } = useAskSession();
  const [value, setValue] = useState("");
  const [topic, setTopic] = useState(0);

  const baseId = useId();
  const headingRef = useRef<HTMLHeadingElement>(null);
  const inputRef = useRef<HTMLInputElement>(null);
  const askRef = useRef(ask);
  const group = groups[topic];

  useEffect(() => {
    askRef.current = ask;
  });

  // Questions handed over by the navigator or the floating Ask control: asked at once, or,
  // with no question, the command line simply takes focus. One may also be waiting from
  // another page, left there before the visitor was brought here.
  useEffect(() => {
    const take = (question: string | undefined) => {
      if (question && prepareQuestion(question) !== null) askRef.current(question);
      else inputRef.current?.focus({ preventScroll: true });
    };
    const pending = takePendingQuestion();
    const frame = pending ? requestAnimationFrame(() => take(pending)) : 0;
    const onAsk = (event: Event) => take((event as CustomEvent<{ question?: string }>).detail?.question);
    window.addEventListener(ASK_EVENT, onAsk);
    return () => {
      cancelAnimationFrame(frame);
      window.removeEventListener(ASK_EVENT, onAsk);
    };
  }, []);
  const earlier = exchanges.filter((exchange) => exchange !== active);
  const numberOf = (exchange: Exchange) => exchanges.indexOf(exchange) + 1;
  const tabId = (index: number) => `${baseId}-tab-${index}`;

  // When the visitor opens a brief, focus lands on its heading: keyboard and screen-reader
  // users arrive at the answer, and the control they pressed may no longer exist.
  useEffect(() => {
    const heading = headingRef.current;
    if (opened === 0 || !heading) return;
    heading.focus({ preventScroll: true });
    showBrief(heading);
  }, [opened]);

  function onTabKey(event: KeyboardEvent<HTMLButtonElement>, index: number) {
    const last = groups.length - 1;
    const targets: Record<string, number> = {
      ArrowRight: index === last ? 0 : index + 1,
      ArrowLeft: index === 0 ? last : index - 1,
      Home: 0,
      End: last,
    };
    const target = targets[event.key];
    if (target === undefined) return;
    event.preventDefault();
    setTopic(target);
    document.getElementById(tabId(target))?.focus();
  }

  return (
    <div className="panel ask-console">
      {/* Command line */}
      <form
        className={`grid ${COLUMNS}`}
        onSubmit={(event) => {
          event.preventDefault();
          if (busy || prepareQuestion(value) === null) return;
          ask(value);
          setValue("");
        }}
      >
        <label htmlFor={`${baseId}-input`} className="label hidden items-center border-r border-rule px-6 text-champagne md:flex">
          Ask
        </label>
        <div className="m-3 flex min-w-0 items-stretch rounded-pill border border-bone/[0.1] bg-carbon/45 shadow-[inset_0_1px_2px_rgb(0_0_0/0.35)] transition-[border-color,background-color] duration-300 focus-within:border-bone/[0.26] focus-within:bg-carbon/60 md:m-4">
          <span aria-hidden="true" className="readout flex items-center pl-5 text-[1.125rem] text-rosso-bright">
            ›
          </span>
          <input
            ref={inputRef}
            id={`${baseId}-input`}
            type="text"
            value={value}
            onChange={(event) => setValue(event.target.value)}
            maxLength={ASK_LIMITS.questionMax}
            autoComplete="off"
            spellCheck="false"
            enterKeyHint="send"
            placeholder="Ask about a project, a skill, the research…"
            aria-label="Ask a question about Omjee's work"
            aria-describedby={`${baseId}-hint`}
            // 17px: at 16px or more, mobile browsers do not zoom the page when the field is focused.
            className="ask-field min-h-[3.25rem] min-w-0 flex-1 bg-transparent px-3 text-[1.0625rem] text-bone caret-rosso-bright placeholder:text-faint"
          />
          <button
            type="submit"
            disabled={busy || prepareQuestion(value) === null}
            className="group m-1.5 inline-flex min-w-[5.5rem] items-center justify-center gap-2 rounded-pill bg-bone px-5 text-[0.9375rem] font-medium text-carbon transition-[background-color,color,transform] duration-300 ease-[var(--ease-soft)] enabled:hover:bg-white enabled:active:scale-[0.97] disabled:bg-bone/[0.08] disabled:text-faint"
          >
            Run
            <Icon
              name="arrow-right"
              size={14}
              className="transition-transform duration-[var(--dur-fast)] ease-[var(--ease-snap)] group-enabled:group-hover:translate-x-1"
            />
          </button>
        </div>
        <p id={`${baseId}-hint`} className="sr-only">
          An AI guide answers from this portfolio&apos;s content and cites its sources.
        </p>
      </form>

      {/* Activity line: a light runs it while a query is in flight, and once more as it lands. */}
      <div aria-hidden="true" className="ask-line" data-busy={busy || undefined}>
        <i key={exchanges.length} data-ran={exchanges.length > 0 || undefined} />
      </div>

      {/* Ask about: topics that swap the suggested questions. It stays above the brief, so a
          visitor can move from question to question without the list shifting under the pointer. */}
      {group && (
        <div className={`grid ${COLUMNS}`}>
          <p id={`${baseId}-about`} className={`${GUTTER} md:!py-[1.0625rem]`}>
            Ask about
          </p>
          <div className="min-w-0">
            <div
              role="tablist"
              aria-labelledby={`${baseId}-about`}
              className="flex gap-1 overflow-x-auto px-3 pb-2 pt-1 [scrollbar-width:none] md:px-4 md:py-3 [&::-webkit-scrollbar]:hidden"
            >
              {groups.map((item, index) => {
                const selected = index === topic;
                return (
                  <button
                    key={item.id}
                    type="button"
                    role="tab"
                    id={tabId(index)}
                    aria-selected={selected}
                    aria-controls={`${baseId}-panel`}
                    tabIndex={selected ? 0 : -1}
                    onClick={() => setTopic(index)}
                    onKeyDown={(event) => onTabKey(event, index)}
                    className={`relative flex min-h-10 shrink-0 items-center gap-2 whitespace-nowrap rounded-pill px-4 text-[0.875rem] font-medium tracking-[-0.01em] transition-[background-color,color] duration-300 ease-[var(--ease-soft)] ${
                      selected ? "bg-bone/[0.1] text-bone shadow-[inset_0_1px_0_rgb(239_235_228/0.08)]" : "text-steel hover:bg-bone/[0.04] hover:text-bone"
                    }`}
                  >
                    {item.label}
                    <span className={`readout text-[0.6875rem] ${selected ? "text-rosso-bright" : "text-faint"}`}>{pad(item.questions.length)}</span>
                  </button>
                );
              })}
            </div>
            <div role="tabpanel" id={`${baseId}-panel`} aria-labelledby={tabId(topic)} className="px-5 py-2.5 md:px-6">
              {/* Keyed by topic so the questions snap in afresh on every switch. */}
              <ul key={group.id} className="grid gap-x-10 sm:grid-cols-2">
                {group.questions.map((question, index) => (
                  <li key={question} className="border-b border-rule last:border-b-0 sm:[&:nth-last-child(2):nth-child(odd)]:border-b-0">
                    <QuestionButton question={question} onAsk={ask} order={index} />
                  </li>
                ))}
              </ul>
            </div>
          </div>
        </div>
      )}

      {active && <Brief key={active.id} exchange={active} number={numberOf(active)} headingRef={headingRef} onAsk={ask} />}

      {/* Session log: earlier briefs, reopened without asking again */}
      {earlier.length > 0 && (
        <div className={`grid border-t border-rule-strong ${COLUMNS}`}>
          <p id={`${baseId}-log`} className={GUTTER}>
            Session log
          </p>
          <ol aria-labelledby={`${baseId}-log`} className="min-w-0 px-5 py-2.5 md:px-6">
            {earlier.map((exchange) => (
              <li key={exchange.id} className="border-b border-rule last:border-b-0">
                <button
                  type="button"
                  onClick={() => reopen(exchange.id)}
                  aria-label={`Reopen brief ${numberOf(exchange)}: ${exchange.question}`}
                  className="group grid min-h-12 w-full grid-cols-[2.75rem_minmax(0,1fr)_auto] items-center gap-x-3 text-left"
                >
                  <span className="readout text-[0.75rem] text-faint transition-colors duration-[var(--dur-fast)] group-hover:text-rosso-bright">
                    Q.{pad(numberOf(exchange))}
                  </span>
                  <span className="truncate text-[0.9375rem] text-steel transition-colors duration-[var(--dur-fast)] group-hover:text-bone">
                    {exchange.question}
                  </span>
                  <span className="label hidden text-faint sm:block">{statusOf(exchange)}</span>
                </button>
              </li>
            ))}
          </ol>
        </div>
      )}
    </div>
  );
}
