"use client";

import { useMemo, useState } from "react";
import { unit } from "./_shared/a-shared";

/**
 * Semantic Recommendation Engine (Aisle) — retrieve, then rank, then explain.
 *
 * The two queries are the README's own examples; the retrieval sources (MiniLM embeddings in
 * FAISS, BM25, product-type matching), the query rules (budget, accessory ≠ product), the five
 * ranking signals and the four shopper profiles are the README's. The candidates, their prices,
 * ratings and similarities, and the signal weights are ILLUSTRATIVE — the real weights live in
 * the repository's engine configuration. The ranking below is really computed from them.
 *
 * Interaction: choose a query and a shopper profile; the shortlist re-ranks and every result
 * shows the signals that put it there.
 */

export const CAPTION =
  "Illustrative candidates and weights — not catalogue data. The queries, retrieval sources, query rules, five signals and four profiles are the README's; the shortlist is computed from the made-up candidates, and each row shows what ranked it.";

type Signal = "relevance" | "rating" | "popularity" | "discount" | "fit";
type ProfileId = "general" | "student" | "builder" | "gamer";

const SIGNALS: { id: Signal; label: string; ink: string }[] = [
  { id: "relevance", label: "Relevance", ink: "rgb(var(--prog))" },
  { id: "rating", label: "Rating", ink: "rgb(var(--prog) / 0.62)" },
  { id: "popularity", label: "Popularity", ink: "rgb(var(--prog) / 0.36)" },
  { id: "discount", label: "Discount", ink: "var(--color-steel)" },
  { id: "fit", label: "Profile fit", ink: "rgb(var(--prog-2))" },
];

const PROFILES: { id: ProfileId; label: string; weights: Record<Signal, number> }[] = [
  { id: "general", label: "General", weights: { relevance: 0.5, rating: 0.2, popularity: 0.14, discount: 0.08, fit: 0.08 } },
  { id: "student", label: "Student", weights: { relevance: 0.42, rating: 0.16, popularity: 0.1, discount: 0.12, fit: 0.2 } },
  { id: "builder", label: "AI/ML builder", weights: { relevance: 0.4, rating: 0.14, popularity: 0.08, discount: 0.06, fit: 0.32 } },
  { id: "gamer", label: "Gamer", weights: { relevance: 0.4, rating: 0.14, popularity: 0.08, discount: 0.06, fit: 0.32 } },
];

interface Candidate {
  name: string;
  price: number;
  rating: number;
  ratings: number;
  discount: number;
  /** Cosine similarity of the query and product embeddings (illustrative). */
  dense: number;
  /** BM25 score, normalised to the best match (illustrative). */
  bm25: number;
  accessory?: boolean;
  /** What each profile looks for: portable and cheaper, GPU and RAM, low latency / refresh. */
  traits: { portable?: number; gpu?: number; ram?: number; gaming?: number };
}

interface Query {
  id: string;
  text: string;
  budget: number;
  type: string;
  candidates: Candidate[];
}

const QUERIES: Query[] = [
  {
    id: "earbuds",
    text: "wireless earbuds under 2000",
    budget: 2000,
    type: "earbuds",
    candidates: [
      { name: "TWS earbuds · A", price: 1499, rating: 4.1, ratings: 12000, discount: 55, dense: 0.82, bm25: 0.9, traits: { portable: 1, gaming: 0.3 } },
      { name: "Neckband · B", price: 999, rating: 4.0, ratings: 30000, discount: 60, dense: 0.74, bm25: 0.6, traits: { portable: 0.8 } },
      { name: "TWS earbuds · C", price: 1899, rating: 4.3, ratings: 2100, discount: 40, dense: 0.85, bm25: 0.85, traits: { portable: 0.9, gaming: 0.9 } },
      { name: "TWS earbuds · D", price: 2499, rating: 4.4, ratings: 9000, discount: 35, dense: 0.86, bm25: 0.9, traits: { portable: 1, gaming: 0.6 } },
      { name: "Earbuds case · E", price: 299, rating: 4.2, ratings: 800, discount: 50, dense: 0.7, bm25: 0.75, accessory: true, traits: {} },
      { name: "TWS earbuds · F", price: 1299, rating: 3.6, ratings: 150, discount: 65, dense: 0.8, bm25: 0.85, traits: { portable: 1, gaming: 0.2 } },
      { name: "Wired earphones · G", price: 399, rating: 3.9, ratings: 50000, discount: 70, dense: 0.62, bm25: 0.4, traits: { portable: 0.7 } },
    ],
  },
  {
    id: "laptop",
    text: "laptop for AI under 90k",
    budget: 90000,
    type: "laptop",
    candidates: [
      { name: "Laptop · RTX-class GPU, 16 GB", price: 84990, rating: 4.3, ratings: 900, discount: 18, dense: 0.84, bm25: 0.8, traits: { gpu: 0.8, ram: 0.7, gaming: 0.8, portable: 0.3 } },
      { name: "Laptop · entry GPU, 8 GB", price: 62990, rating: 4.1, ratings: 2500, discount: 25, dense: 0.8, bm25: 0.8, traits: { gpu: 0.5, ram: 0.3, gaming: 0.6, portable: 0.4 } },
      { name: "Thin laptop · 16 GB", price: 54990, rating: 4.4, ratings: 4000, discount: 20, dense: 0.72, bm25: 0.7, traits: { gpu: 0.1, ram: 0.7, portable: 0.9 } },
      { name: "Laptop · high-end GPU", price: 104990, rating: 4.5, ratings: 700, discount: 12, dense: 0.87, bm25: 0.8, traits: { gpu: 1, ram: 0.8, gaming: 1 } },
      { name: "Laptop bag · 15.6 in", price: 1299, rating: 4.2, ratings: 15000, discount: 55, dense: 0.69, bm25: 0.9, accessory: true, traits: {} },
      { name: "Laptop · 8 GB", price: 38990, rating: 3.9, ratings: 6000, discount: 30, dense: 0.64, bm25: 0.7, traits: { ram: 0.3, portable: 0.7 } },
      { name: "Laptop · RTX-class GPU, 8 GB", price: 74990, rating: 3.8, ratings: 60, discount: 22, dense: 0.83, bm25: 0.8, traits: { gpu: 0.8, ram: 0.3, gaming: 0.8, portable: 0.3 } },
    ],
  },
];

/** Bayesian smoothing toward a prior: few ratings count for less (prior and weight illustrative). */
const PRIOR = 3.9;
const PRIOR_WEIGHT = 200;
const smoothed = (c: Candidate) => (PRIOR * PRIOR_WEIGHT + c.rating * c.ratings) / (PRIOR_WEIGHT + c.ratings);

function fitFor(profile: ProfileId, c: Candidate, budget: number): number {
  const t = c.traits;
  switch (profile) {
    case "student":
      return 0.6 * (t.portable ?? 0) + 0.4 * (1 - c.price / budget);
    case "builder":
      return 0.6 * (t.gpu ?? 0) + 0.4 * (t.ram ?? 0);
    case "gamer":
      return t.gaming ?? 0;
    default:
      return 0.5;
  }
}

interface Ranked {
  c: Candidate;
  parts: Record<Signal, number>;
  score: number;
}

function rank(query: Query, profileId: ProfileId) {
  const profile = PROFILES.find((p) => p.id === profileId)!;
  const kept: Ranked[] = [];
  const excluded: { c: Candidate; why: string }[] = [];
  for (const c of query.candidates) {
    if (c.accessory) {
      excluded.push({ c, why: `accessory — not a ${query.type}` });
      continue;
    }
    if (c.price > query.budget) {
      excluded.push({ c, why: "over budget" });
      continue;
    }
    const signals: Record<Signal, number> = {
      relevance: 0.6 * c.dense + 0.4 * c.bm25,
      rating: (smoothed(c) - 1) / 4,
      popularity: Math.log10(1 + c.ratings) / 5,
      discount: c.discount / 80,
      fit: fitFor(profileId, c, query.budget),
    };
    const parts = Object.fromEntries(
      SIGNALS.map(({ id }) => [id, profile.weights[id] * signals[id]]),
    ) as Record<Signal, number>;
    kept.push({ c, parts, score: Object.values(parts).reduce((a, b) => a + b, 0) });
  }
  kept.sort((a, b) => b.score - a.score);
  return { kept, excluded };
}

/** Indian digit grouping (1,04,990), by hand so server and client always agree. */
function rupees(v: number): string {
  const digits = String(Math.round(v));
  if (digits.length <= 3) return `₹${digits}`;
  const head = digits.slice(0, -3).replace(/\B(?=(\d{2})+(?!\d))/g, ",");
  return `₹${head},${digits.slice(-3)}`;
}

/* The neighbourhood: query at the centre, candidates at a distance that follows similarity. */
const VW = 300;
const VH = 220;
const CX = VW / 2;
const CY = VH / 2;
const r1 = (v: number) => Math.round(v * 10) / 10;

const BACKGROUND = Array.from({ length: 70 }, (_, k) => {
  const angle = unit(k, 3) * Math.PI * 2;
  const radius = 70 + unit(k, 5) * 70;
  return [r1(CX + Math.cos(angle) * radius * 1.3), r1(CY + Math.sin(angle) * radius * 0.72)] as const;
});

const place = (c: Candidate, k: number) => {
  const angle = unit(k, 11, Math.round(c.dense * 100)) * Math.PI * 2;
  const radius = 12 + (1 - c.dense) * 170;
  return [r1(CX + Math.cos(angle) * radius * 1.3), r1(CY + Math.sin(angle) * radius * 0.72)] as const;
};

export function RecEngineFigure({ wide = false }: { wide?: boolean }) {
  const [queryId, setQueryId] = useState(QUERIES[0].id);
  const [profile, setProfile] = useState<ProfileId>("general");
  const query = QUERIES.find((q) => q.id === queryId)!;
  const { kept, excluded } = useMemo(() => rank(query, profile), [query, profile]);
  const top = kept.slice(0, 5);
  const best = Math.max(...kept.map((r) => r.score));
  const rankOf = new Map(kept.map((r, i) => [r.c.name, i]));

  const control = (on: boolean) =>
    `label min-h-9 rounded-full border px-3.5 transition-colors duration-[var(--dur-fast)] ${
      on ? "border-[rgb(var(--prog)/0.55)] bg-[rgb(var(--prog)/0.1)] text-bone" : "border-transparent text-steel hover:bg-[rgb(239_235_228/0.04)] hover:text-bone"
    }`;

  return (
    <figure>
      <div className="flex flex-wrap items-end justify-between gap-x-6 gap-y-2 pb-3">
        <div role="group" aria-label="Query" className="flex flex-wrap gap-x-1">
          {QUERIES.map((q) => (
            <button key={q.id} type="button" aria-pressed={q.id === queryId} onClick={() => setQueryId(q.id)} className={control(q.id === queryId)}>
              &ldquo;{q.text}&rdquo;
            </button>
          ))}
        </div>
        <div role="group" aria-label="Shopper profile" className="flex flex-wrap gap-x-1">
          {PROFILES.map((p) => (
            <button key={p.id} type="button" aria-pressed={p.id === profile} onClick={() => setProfile(p.id)} className={control(p.id === profile)}>
              {p.label}
            </button>
          ))}
        </div>
      </div>

      <p className="label border-t border-rule-strong pt-2 text-faint">
        Parsed · type <span className="text-bone">{query.type}</span> · budget{" "}
        <span className="text-bone">≤ {rupees(query.budget)}</span> · accessories excluded
      </p>

      <div className={`mt-4 grid gap-x-8 gap-y-6 ${wide ? "md:grid-cols-[minmax(0,0.8fr)_minmax(0,1.2fr)]" : "sm:grid-cols-[minmax(0,0.85fr)_minmax(0,1.15fr)]"}`}>
        {/* Stage 1: retrieve. */}
        <div>
          <p className="label text-faint">
            <span className="prog-ink">01 Retrieve</span> · MiniLM + FAISS, BM25, type
          </p>
          <svg
            viewBox={`0 0 ${VW} ${VH}`}
            className="mt-2 block h-auto w-full"
            role="img"
            aria-label={`Embedding neighbourhood of the query; ${kept.length} candidates kept, ${excluded.length} filtered out.`}
          >
            {BACKGROUND.map(([x, y], k) => (
              <rect key={k} x={x - 1} y={y - 1} width={2} height={2} fill="var(--color-metal-2)" />
            ))}
            {query.candidates.map((c, k) => {
              const [x, y] = place(c, k);
              const out = !rankOf.has(c.name);
              const position = rankOf.get(c.name);
              const shortlisted = position !== undefined && position < 3;
              return (
                <g key={c.name}>
                  <line
                    x1={CX}
                    y1={CY}
                    x2={x}
                    y2={y}
                    stroke={out ? "var(--color-rule-strong)" : `rgb(var(--prog) / ${shortlisted ? 0.8 : 0.4})`}
                    strokeWidth={1}
                    strokeDasharray={out ? "2 3" : undefined}
                  />
                  {c.bm25 >= 0.8 && <circle cx={x} cy={y} r={6} fill="none" stroke="var(--color-steel)" strokeWidth={0.75} />}
                  {out ? (
                    <path d={`M${x - 3} ${y - 3}l6 6m0 -6l-6 6`} stroke="var(--color-faint)" strokeWidth={1} />
                  ) : (
                    <rect x={x - 3} y={y - 3} width={6} height={6} fill={shortlisted ? "rgb(var(--prog-2))" : "rgb(var(--prog))"} />
                  )}
                  {position !== undefined && position < 3 && (
                    <text x={x + 8} y={y + 3} className="label" fill="var(--color-bone)">
                      {position + 1}
                    </text>
                  )}
                </g>
              );
            })}
            <circle cx={CX} cy={CY} r={4} fill="var(--color-bone)" />
          </svg>
          <p className="label mt-2 flex flex-wrap gap-x-4 gap-y-1 text-faint">
            <span>
              <span aria-hidden="true" className="mr-1.5 inline-block size-1.5 bg-bone align-middle" />
              Query
            </span>
            <span>
              <span aria-hidden="true" className="mr-1.5 inline-block size-2 rounded-full border border-steel align-middle" />
              Strong BM25 hit
            </span>
            <span>× Filtered</span>
          </p>
        </div>

        {/* Stage 2: rank, with every result's explanation. */}
        <div>
          <p className="label text-faint">
            <span className="prog-ink">02 Rank</span> · five signals, profile {PROFILES.find((p) => p.id === profile)!.label}
          </p>
          <ol className="mt-2" aria-label="Shortlist">
            {top.map((r, i) => (
              <li key={r.c.name} className="border-b border-rule py-2">
                <div className="flex items-baseline justify-between gap-3">
                  <span className="min-w-0 truncate text-[0.875rem] text-bone">
                    <span className="label mr-2 text-faint">{String(i + 1).padStart(2, "0")}</span>
                    {r.c.name}
                  </span>
                  <span className="readout shrink-0 text-[0.75rem] text-steel">
                    {rupees(r.c.price)} · {r.score.toFixed(2)}
                  </span>
                </div>
                <div
                  className="mt-1.5 flex h-1.5"
                  style={{ width: `${(r.score / best) * 100}%` }}
                  role="img"
                  aria-label={SIGNALS.map((s) => `${s.label} ${r.parts[s.id].toFixed(2)}`).join(", ")}
                >
                  {SIGNALS.map((s) => (
                    <span
                      key={s.id}
                      className="h-full transition-[flex-grow] duration-[var(--dur-base)] ease-[var(--ease-out)]"
                      style={{ flexGrow: r.parts[s.id], flexBasis: 0, background: s.ink }}
                    />
                  ))}
                </div>
              </li>
            ))}
          </ol>
          <p className="label mt-3 flex flex-wrap gap-x-3 gap-y-1 text-faint">
            {SIGNALS.map((s) => (
              <span key={s.id}>
                <span aria-hidden="true" className="mr-1.5 inline-block h-1.5 w-2.5 align-middle" style={{ background: s.ink }} />
                {s.label}
              </span>
            ))}
          </p>
          <p className="mt-3 text-[0.8125rem] leading-snug text-steel">
            Filtered:{" "}
            {excluded.map((e, k) => (
              <span key={e.c.name}>
                {k > 0 && "; "}
                <span className="text-bone/80">{e.c.name}</span> — {e.why}
              </span>
            ))}
            .
          </p>
        </div>
      </div>
    </figure>
  );
}
