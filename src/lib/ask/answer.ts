/**
 * Orchestrates one answer:
 *
 *   1. intent rule  → `direct`   (composed from content, no model call)
 *   2. retrieval    → `llm`      (model writes from the retrieved excerpts, if a key is set)
 *   3. otherwise    → `fallback` (extractive answer from the same excerpts, or an honest
 *                                 "not documented" when nothing relevant was found)
 *
 * The assistant works fully without an API key; the model only improves phrasing for
 * questions the rules do not cover.
 */

import { skills, statusLabel, visibleProjects } from "@/content";
import type { Project } from "@/content";

import { NOT_DOCUMENTED, composeDirect } from "./direct";
import { classifyIntent } from "./intents";
import { CASE_SECTIONS, loadKnowledgeBase } from "./knowledge";
import type { KnowledgeBase } from "./knowledge";
import { generateAnswer, isModelConfigured } from "./llm";
import {
  ACTIONS,
  MAX_ACTIONS,
  MAX_FOLLOW_UPS,
  MAX_RELATED,
  MAX_STATS,
  actionsFromDocs,
  cardsFromDocs,
  projectAction,
  projectCard,
  relatedFrom,
  toSources,
} from "./present";
import { bestSentences, resolveFocus, retrieve, subjectTerms } from "./retrieve";
import type { Focus, Hit, Retrieval } from "./retrieve";
import { generalFollowUps, projectFollowUps } from "./suggestions";
import { ensurePeriod, joinList, normalize } from "./text";
import type { AskAction, AskCard, AskMode, AskResponse, AskStat, AskTurn, KnowledgeDoc } from "./types";

/** Documents passed to the model as context. */
const CONTEXT_DOCS = 6;
/** Below this share of matched question terms, an extractive answer would be a guess. */
const MIN_COVERAGE = 0.55;
/** A document must score at least this fraction of the best hit to be cited. */
const CITATION_RATIO = 0.4;

/** The parts of a response that only some answers have. */
interface Extras {
  stats?: readonly AskStat[];
  related?: readonly string[];
  actions?: readonly AskAction[];
}

/**
 * A research prototype is labelled as one wherever it is named. Answers about such a project
 * already state its status; this covers the ones that only mention it in passing — a list of
 * featured work, a technology's stack — and text written by the model.
 */
function withResearchCaveat(answer: string): string {
  const said = answer.toLowerCase();
  const notes = visibleProjects()
    .filter((project) => project.status === "research" && project.statusNote && answer.includes(project.title))
    .filter((project) => !said.includes(statusLabel[project.status].toLowerCase()))
    .map((project) => `Note on ${project.title}: ${project.statusNote}`);
  return [answer, ...notes].join("\n\n");
}

function finish(
  mode: AskMode,
  answer: string,
  docs: readonly KnowledgeDoc[],
  cards: readonly AskCard[],
  followUps: readonly string[],
  question: string,
  extras: Extras = {},
): AskResponse {
  const asked = normalize(question);
  const unique = [...new Set(followUps)].filter((followUp) => normalize(followUp) !== asked);
  const stats = (extras.stats ?? []).slice(0, MAX_STATS);
  const related = (extras.related ?? []).slice(0, MAX_RELATED);
  const actions = (extras.actions ?? []).slice(0, MAX_ACTIONS);
  return {
    answer: withResearchCaveat(answer),
    mode,
    sources: toSources(docs),
    cards: [...cards],
    followUps: unique.slice(0, MAX_FOLLOW_UPS),
    // Optional fields are left out rather than sent empty, so "present" always means "show it".
    ...(stats.length > 0 ? { stats } : {}),
    ...(related.length > 0 ? { related } : {}),
    ...(actions.length > 0 ? { actions } : {}),
  };
}

function subjectProject(focus: Focus, hits: readonly Hit[]): Project | undefined {
  const entity = focus.subject?.kind === "project" ? focus.subject.id : hits[0]?.doc.entity;
  if (!entity?.startsWith("project:")) return undefined;
  return visibleProjects().find((project) => project.slug === entity.slice("project:".length));
}

const followUpsFor = (project: Project | undefined): string[] =>
  project ? [...projectFollowUps(project, "overview"), ...generalFollowUps()] : generalFollowUps();

/** Hits close enough to the best one to be worth citing. */
function citable(hits: readonly Hit[]): KnowledgeDoc[] {
  const best = hits[0]?.score ?? 0;
  return hits.filter((hit) => hit.score >= best * CITATION_RATIO).map((hit) => hit.doc);
}

/** What surrounds an answer written from retrieved documents rather than by an intent rule. */
function extrasFromDocs(docs: readonly KnowledgeDoc[], project: Project | undefined): Extras {
  const domainId = docs.find((doc) => doc.type === "skill")?.id.slice("skill:".length);
  const domain = skills.find((candidate) => candidate.id === domainId);
  return {
    related: project ? relatedFrom(project.stack) : domain ? relatedFrom(domain.items) : undefined,
    actions: actionsFromDocs(docs, project),
  };
}

function describeOrigin(doc: KnowledgeDoc): string {
  const subject = doc.label.split(" / ")[0];
  switch (doc.type) {
    case "case-study": {
      const section = CASE_SECTIONS.find(({ key }) => doc.id.endsWith(`:${key}`))?.label.toLowerCase();
      return `From the ${subject} case study${section ? ` (${section})` : ""}:`;
    }
    case "project":
      return `From the ${subject} overview:`;
    case "skill":
      return `From the capabilities section (${doc.title}):`;
    case "experience":
    case "education":
    case "achievement":
      return "From the experience section:";
    case "now":
      // Research no longer has a section of its own; it closes the work sector.
      return "From the research and direction notes:";
    case "repo":
      // "Garage / <repo> / README" — say which README, not just "the Garage".
      return doc.id.startsWith("readme:") ? `From the ${doc.label.split(" / ")[1]} README:` : "From the Garage:";
    case "resume":
      return "From his résumé:";
    case "contact":
      return "From the contact section:";
    default:
      return "From the about section:";
  }
}

function notDocumented(question: string, focus: Focus, hits: readonly Hit[]): AskResponse {
  const project = focus.subject?.kind === "project" ? subjectProject(focus, hits) : undefined;
  const sections = project?.caseStudy
    ? CASE_SECTIONS.filter(({ key }) => project.caseStudy?.[key]?.length).map(({ label }) => label.toLowerCase())
    : [];
  const pointer =
    project && sections.length > 0
      ? `The ${project.title} case study does cover its ${joinList(sections)}.`
      : "The portfolio does cover his projects, research, skills and experience.";
  return finish("fallback", `${NOT_DOCUMENTED}\n\n${pointer}`, [], project ? [projectCard(project)] : [], followUpsFor(project), question, {
    actions: project ? [projectAction(project), ACTIONS.work] : [ACTIONS.work, ACTIONS.research, ACTIONS.experience],
  });
}

/** An answer built from the best-matching sentences of the top documents. */
function extractive(question: string, retrieval: Retrieval, focus: Focus, kb: KnowledgeBase): AskResponse {
  const first = retrieval.hits[0];
  const named = subjectTerms(focus);
  const lead = `${describeOrigin(first.doc)} ${bestSentences(question, first.doc.text, kb, 3, 70, named).map(ensurePeriod).join(" ")}`;

  // When the question names two projects, the supporting excerpt must come from the other one.
  const counterpart =
    focus.explicit.length > 1 ? retrieval.hits.find((hit) => hit.doc.entity !== undefined && hit.doc.entity !== first.doc.entity) : undefined;
  const second = counterpart ?? retrieval.hits[1];
  const useSecond = second !== undefined && (counterpart !== undefined || second.score >= first.score * 0.6);
  const support = useSecond
    ? `${describeOrigin(second.doc)} ${bestSentences(question, second.doc.text, kb, 2, 45, named).map(ensurePeriod).join(" ")}`
    : null;

  const docs = useSecond ? [first.doc, second.doc] : [first.doc];
  const project = subjectProject(focus, retrieval.hits);
  return finish(
    "fallback",
    [lead, support].filter(Boolean).join("\n\n"),
    docs,
    cardsFromDocs(docs, kb),
    followUpsFor(project),
    question,
    // A comparison has no single subject, so it carries no one project's stack.
    extrasFromDocs(docs, counterpart ? undefined : project),
  );
}

/**
 * Answer a visitor's question from the portfolio content.
 * `history` holds the earlier turns of the conversation, oldest first.
 */
export async function answerQuestion(question: string, history: readonly AskTurn[] = []): Promise<AskResponse> {
  const kb = await loadKnowledgeBase();
  const focus = resolveFocus(question, history, kb);

  const composed = composeDirect(classifyIntent(question, focus, kb), kb, question);
  if (composed) {
    const byId = new Map(kb.docs.map((doc) => [doc.id, doc]));
    const docs = composed.sourceIds.map((id) => byId.get(id)).filter((doc): doc is KnowledgeDoc => doc !== undefined);
    return finish("direct", composed.answer, docs, composed.cards, composed.followUps, question, composed);
  }

  const retrieval = retrieve(question, focus, kb, CONTEXT_DOCS);
  // Nothing in the portfolio shares a meaningful word with the question: there is nothing to
  // ground an answer in, so do not spend a model call on it.
  const hasSignal = retrieval.hits.length > 0 && (retrieval.coverage > 0 || focus.subject !== null);
  if (!hasSignal) return notDocumented(question, focus, retrieval.hits);

  if (isModelConfigured()) {
    const written = await generateAnswer(question, history, retrieval.hits.map((hit) => hit.doc));
    if (written) {
      // Citing sources for "this isn't documented" would suggest the opposite.
      const declined = written.includes("isn't currently documented") || written.includes("only help with");
      if (declined) {
        return finish("llm", written, [], [], generalFollowUps(), question, { actions: [ACTIONS.work, ACTIONS.research, ACTIONS.experience] });
      }
      const docs = citable(retrieval.hits);
      const project = subjectProject(focus, retrieval.hits);
      return finish(
        "llm",
        written,
        docs,
        cardsFromDocs(docs, kb),
        followUpsFor(project),
        question,
        extrasFromDocs(docs, focus.explicit.length > 1 ? undefined : project),
      );
    }
  }

  return retrieval.coverage >= MIN_COVERAGE ? extractive(question, retrieval, focus, kb) : notDocumented(question, focus, retrieval.hits);
}
