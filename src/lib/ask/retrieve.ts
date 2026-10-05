/**
 * Deterministic lexical retrieval over the knowledge index.
 *
 * BM25 over weighted fields (title, tags, text), with query expansion from a small synonym
 * map, an `importance` multiplier per document, and boosts when the question names a
 * project, repository or technology. No embeddings: the corpus is a few dozen short documents.
 */

import type { Entity, KnowledgeBase } from "./knowledge";
import { splitSentences, stem, stemTokens, synonymsOf, terms } from "./text";
import type { AskTurn, KnowledgeDoc } from "./types";

const FIELD_WEIGHT = { title: 3, tags: 2, text: 1 } as const;
const K1 = 1.4;
const B = 0.6;
const SYNONYM_WEIGHT = 0.5;

interface IndexedDoc {
  doc: KnowledgeDoc;
  frequency: Map<string, number>;
  length: number;
  /** Tags as stemmed phrases, for technology boosts. */
  tagPhrases: Set<string>;
}

interface Index {
  entries: IndexedDoc[];
  documentFrequency: Map<string, number>;
  averageLength: number;
}

const indexes = new WeakMap<KnowledgeBase, Index>();

function indexOf(kb: KnowledgeBase): Index {
  const existing = indexes.get(kb);
  if (existing) return existing;

  const documentFrequency = new Map<string, number>();
  const entries = kb.docs.map((doc): IndexedDoc => {
    const frequency = new Map<string, number>();
    const add = (text: string, weight: number) => {
      for (const term of terms(text)) frequency.set(term, (frequency.get(term) ?? 0) + weight);
    };
    add(doc.title, FIELD_WEIGHT.title);
    add(doc.tags.join(" . "), FIELD_WEIGHT.tags);
    add(doc.text, FIELD_WEIGHT.text);
    for (const term of frequency.keys()) documentFrequency.set(term, (documentFrequency.get(term) ?? 0) + 1);
    const length = [...frequency.values()].reduce((sum, value) => sum + value, 0);
    return { doc, frequency, length, tagPhrases: new Set(doc.tags.map((tag) => stemTokens(tag).join(" "))) };
  });

  const averageLength = entries.reduce((sum, entry) => sum + entry.length, 0) / Math.max(entries.length, 1);
  const index: Index = { entries, documentFrequency, averageLength };
  indexes.set(kb, index);
  return index;
}

function inverseDocumentFrequency(index: Index, term: string): number {
  const containing = index.documentFrequency.get(term) ?? 0;
  return Math.log(1 + (index.entries.length - containing + 0.5) / (containing + 0.5));
}

/** True when the term, or one of its synonyms, appears anywhere in the portfolio content. */
export function isKnownTerm(kb: KnowledgeBase, term: string): boolean {
  const { documentFrequency } = indexOf(kb);
  return documentFrequency.has(term) || synonymsOf(term).some((synonym) => documentFrequency.has(synonym));
}

/* ------------------------------------------------------------------- entities */

/** Entities named in a piece of text, most specific match first. */
export function detectEntities(text: string, kb: KnowledgeBase): Entity[] {
  const tokens = stemTokens(text);
  const padded = ` ${tokens.join(" ")} `;
  const expanded = new Set(tokens.flatMap((token) => [token, ...synonymsOf(token)]));

  const matches: { entity: Entity; alias: string }[] = [];
  for (const entity of kb.entities) {
    const hits = entity.aliases.filter(
      (alias) =>
        padded.includes(` ${alias} `) ||
        // Single-word project names also match through synonyms ("EEG" → qEEG).
        (entity.kind !== "tech" && !alias.includes(" ") && expanded.has(alias)),
    );
    if (hits.length > 0) matches.push({ entity, alias: hits.sort((a, b) => b.length - a.length)[0] });
  }

  // A technology mentioned only as part of a project or repository name is not a separate hit —
  // including when the name was reached through a synonym ("the EEG project" → qEEG Subtyping).
  const named = matches.filter((match) => match.entity.kind !== "tech");
  const partOfName = (alias: string) =>
    named.some((other) => ` ${other.alias} `.includes(` ${alias} `) || synonymsOf(alias).includes(other.alias));
  return matches
    .filter((match) => match.entity.kind !== "tech" || !partOfName(match.alias))
    .sort((a, b) => b.alias.length - a.alias.length)
    .map((match) => match.entity);
}

export interface Focus {
  /** Projects and repositories named in the question itself. */
  explicit: Entity[];
  /** Technologies named in the question itself. */
  technologies: Entity[];
  /** The project or repository the question is about, possibly inherited from earlier turns. */
  subject: Entity | null;
  /** True when `subject` came from the conversation history rather than the question. */
  carried: boolean;
}

const REFERS_BACK = /\b(it|its|it's|that|this|those|these|them|they|there|the (project|system|repo|repository|model|pipeline|tool|app))\b/i;
const REFERS_TO_PERSON = /\b(omjee|giri|he|his|him|he's)\b/i;

/**
 * Work out what the question is about. A follow-up such as "What technologies were used?"
 * names nothing, so it inherits the project discussed in the most recent turn — unless it is
 * plainly a question about Omjee himself ("What is he researching?").
 */
export function resolveFocus(question: string, history: readonly AskTurn[], kb: KnowledgeBase): Focus {
  const detected = detectEntities(question, kb);
  const explicit = detected.filter((entity) => entity.kind !== "tech");
  const technologies = detected.filter((entity) => entity.kind === "tech");
  if (explicit.length > 0) return { explicit, technologies, subject: explicit[0], carried: false };

  const mayCarry = history.length > 0 && (REFERS_BACK.test(question) || !REFERS_TO_PERSON.test(question));
  if (mayCarry) {
    for (let index = history.length - 1; index >= 0; index -= 1) {
      const turn = history[index];
      const mentioned = detectEntities(turn.content, kb).filter((entity) => entity.kind !== "tech");
      // An assistant turn that lists several projects does not single one out.
      if (mentioned.length === 1 || (turn.role === "user" && mentioned.length > 0)) {
        return { explicit, technologies, subject: mentioned[0], carried: true };
      }
    }
  }
  return { explicit, technologies, subject: null, carried: false };
}

/* ------------------------------------------------------------------ retrieval */

export interface Hit {
  doc: KnowledgeDoc;
  score: number;
}

export interface Retrieval {
  hits: Hit[];
  /**
   * Share (0–1, weighted by rarity) of the question's content terms found in the top
   * documents. Terms that appear nowhere in the portfolio count fully against it.
   */
  coverage: number;
  /** Content terms that appear nowhere in the portfolio. */
  unknownTerms: string[];
}

/** Question words that say how to answer rather than what to look for. */
const LOW_SIGNAL = new Set(
  (
    "explain describe overview summary summarize summarise detail project work thing kind type portfolio website site " +
    "compare comparison compared different difference differ versus vs similar similarity better"
  )
    .split(" ")
    .map(stem),
);

/** Question terms at full weight, their synonyms at reduced weight. `ignore` drops terms before expansion. */
function weightedQuery(question: string, ignore: ReadonlySet<string> = new Set()): Map<string, number> {
  const query = new Map<string, number>();
  const base = [...new Set(terms(question))].filter((term) => !ignore.has(term));
  for (const term of base) query.set(term, 1);
  for (const term of base) {
    for (const synonym of synonymsOf(term)) if (!query.has(synonym)) query.set(synonym, SYNONYM_WEIGHT);
  }
  return query;
}

function bm25(index: Index, entry: IndexedDoc, query: Map<string, number>): number {
  let score = 0;
  for (const [term, weight] of query) {
    const frequency = entry.frequency.get(term);
    if (!frequency) continue;
    const normalised = (frequency * (K1 + 1)) / (frequency + K1 * (1 - B + (B * entry.length) / index.averageLength));
    score += weight * inverseDocumentFrequency(index, term) * normalised;
  }
  return score;
}

const entryHasTerm = (entry: IndexedDoc, term: string): boolean =>
  entry.frequency.has(term) || synonymsOf(term).some((synonym) => entry.frequency.has(synonym));

export function retrieve(question: string, focus: Focus, kb: KnowledgeBase, limit = 6): Retrieval {
  const index = indexOf(kb);
  const query = weightedQuery(question);
  const subjectBoost = focus.carried ? 1.6 : 2.2;
  const subjectFloor = focus.carried ? 0.6 : 1;
  // Every project named in the question counts ("Compare Legal Lens and ARGUS"), not just the first.
  const subjects = new Set(focus.explicit.length > 0 ? focus.explicit.map((entity) => entity.id) : focus.subject ? [focus.subject.id] : []);

  const scored = index.entries
    .map((entry) => {
      let score = bm25(index, entry, query) * entry.doc.importance;
      if (entry.doc.entity && subjects.has(entry.doc.entity)) {
        // The floor keeps the subject's documents in play even when the question shares no
        // words with them ("Tell me more about it").
        score = score * subjectBoost + subjectFloor * entry.doc.importance;
      }
      if (focus.technologies.some((technology) => technology.aliases.some((alias) => entry.tagPhrases.has(alias)))) {
        score *= 1.25;
      }
      return { entry, score };
    })
    .filter((item) => item.score > 0)
    .sort((a, b) => b.score - a.score);

  let top = scored.slice(0, limit);
  if (subjects.size > 1) {
    // One project's documents would otherwise crowd out the other's: give each an equal share.
    const share = Math.ceil(limit / subjects.size);
    const balanced = [...subjects].flatMap((id) => scored.filter((item) => item.entry.doc.entity === id).slice(0, share));
    if (balanced.length > 0) top = balanced.sort((a, b) => b.score - a.score).slice(0, limit);
  }

  const namedTokens = new Set(
    [...focus.explicit, ...focus.technologies].flatMap((entity) => entity.aliases.flatMap((alias) => alias.split(" "))),
  );
  const contentTerms = [...new Set(terms(question))].filter((term) => !namedTokens.has(term) && !LOW_SIGNAL.has(term));

  let coverage: number;
  const unknownTerms: string[] = [];
  if (contentTerms.length === 0) {
    coverage = top.length > 0 ? 1 : 0;
  } else {
    const leading = top.slice(0, 3);
    let matched = 0;
    let total = 0;
    for (const term of contentTerms) {
      const weight = inverseDocumentFrequency(index, term);
      total += weight;
      if (leading.some((item) => entryHasTerm(item.entry, term))) matched += weight;
      if (!isKnownTerm(kb, term)) unknownTerms.push(term);
    }
    coverage = total > 0 ? matched / total : 0;
  }

  return { hits: top.map((item) => ({ doc: item.entry.doc, score: item.score })), coverage, unknownTerms };
}

/** The words that name the question's subject; every sentence of its documents is about it. */
export function subjectTerms(focus: Focus): Set<string> {
  const entities = [...focus.explicit, ...(focus.subject ? [focus.subject] : [])];
  return new Set(entities.flatMap((entity) => entity.aliases.flatMap((alias) => alias.split(" "))));
}

/**
 * The sentences of a document that best match the question, in their original order.
 * Used to build extractive answers when no model is available.
 *
 * `ignore` holds terms that must not count as a match — the subject's own name, which (with
 * its synonyms) would otherwise favour a title line or a repository URL over the sentence
 * that answers. When nothing matches at all, the document's opening sentences stand in.
 */
export function bestSentences(
  question: string,
  text: string,
  kb: KnowledgeBase,
  maxSentences: number,
  maxWords: number,
  ignore: ReadonlySet<string> = new Set(),
): string[] {
  const index = indexOf(kb);
  const query = weightedQuery(question, ignore);
  const sentences = splitSentences(text);

  const scored = sentences
    .map((sentence, position) => {
      const present = new Set(terms(sentence));
      let score = 0;
      for (const [term, weight] of query) if (present.has(term)) score += weight * inverseDocumentFrequency(index, term);
      return { sentence, position, score };
    })
    .sort((a, b) => b.score - a.score || a.position - b.position);
  const matching = scored.filter((candidate) => candidate.score > 0);
  const ranked = matching.length > 0 ? matching : scored;

  const chosen: typeof ranked = [];
  let words = 0;
  for (const candidate of ranked) {
    const length = candidate.sentence.split(/\s+/).length;
    if (chosen.length >= maxSentences || (chosen.length > 0 && words + length > maxWords)) continue;
    chosen.push(candidate);
    words += length;
  }
  return chosen.sort((a, b) => a.position - b.position).map((candidate) => candidate.sentence);
}
