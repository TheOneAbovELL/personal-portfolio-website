/**
 * Turns content records and knowledge documents into what the UI renders around an answer:
 * `sources`, `cards`, `stats`, `related` and `actions`.
 */

import { experience, profile, skills, statusLabel, visibleProjects } from "@/content";
import type { Experience, Project, SkillDomain } from "@/content";
import type { GarageRepo } from "@/lib/github";

import type { KnowledgeBase } from "./knowledge";
import { projectRoute } from "./knowledge";
import type { AskAction, AskCard, AskSource, AskStat, KnowledgeDoc, KnowledgeType } from "./types";

export const MAX_SOURCES = 4;
export const MAX_CARDS = 4;
export const MAX_FOLLOW_UPS = 3;
export const MAX_STATS = 4;
export const MAX_RELATED = 8;
export const MAX_ACTIONS = 3;

/* ---------------------------------------------------------------------- cards */

export const projectCard = (project: Project): AskCard => ({
  kind: "project",
  title: project.title,
  subtitle: project.tagline,
  href: projectRoute(project),
  tags: project.stack.slice(0, 4),
  // The status travels with the card so a research prototype is labelled wherever it is shown.
  status: statusLabel[project.status],
});

export const repoCard = (repo: GarageRepo): AskCard => ({
  kind: "repo",
  title: repo.title,
  subtitle: repo.description ?? undefined,
  href: repo.url,
  tags: [repo.category, repo.language].filter((tag): tag is string => Boolean(tag)),
});

export const experienceCard = (role: Experience): AskCard => ({
  kind: "experience",
  title: role.role,
  subtitle: role.unit ? `${role.organization} · ${role.unit}` : role.organization,
  href: "/#experience",
  tags: role.stack.slice(0, 4),
});

export const skillCard = (domain: SkillDomain): AskCard => ({
  kind: "skill",
  title: domain.title,
  subtitle: domain.summary,
  href: "/#capabilities",
  tags: domain.items.slice(0, 5),
});

export function toSources(docs: readonly KnowledgeDoc[]): AskSource[] {
  const seen = new Set<string>();
  const sources: AskSource[] = [];
  for (const doc of docs) {
    const key = `${doc.label}|${doc.href}`;
    if (seen.has(key)) continue;
    seen.add(key);
    sources.push({ label: doc.label, href: doc.href, type: doc.type });
    if (sources.length === MAX_SOURCES) break;
  }
  return sources;
}

/** The card that best represents a retrieved document, if it has one. */
function cardFor(doc: KnowledgeDoc, kb: KnowledgeBase): AskCard | null {
  const key = doc.id.slice(doc.id.indexOf(":") + 1);
  switch (doc.type) {
    case "project":
    case "case-study":
    case "now": {
      const slug = doc.entity?.startsWith("project:") ? doc.entity.slice("project:".length) : null;
      const project = slug ? visibleProjects().find((candidate) => candidate.slug === slug) : undefined;
      return project ? projectCard(project) : null;
    }
    case "repo": {
      const repo = kb.repos.find((candidate) => candidate.name === key);
      return repo ? repoCard(repo) : null;
    }
    case "experience": {
      const role = experience.find((candidate) => candidate.id === key);
      return role ? experienceCard(role) : null;
    }
    case "skill": {
      const domain = skills.find((candidate) => candidate.id === key);
      return domain ? skillCard(domain) : null;
    }
    default:
      return null;
  }
}

export function cardsFromDocs(docs: readonly KnowledgeDoc[], kb: KnowledgeBase): AskCard[] {
  const cards = new Map<string, AskCard>();
  for (const doc of docs) {
    const card = cardFor(doc, kb);
    if (card && !cards.has(`${card.kind}|${card.title}`)) cards.set(`${card.kind}|${card.title}`, card);
  }
  return [...cards.values()].slice(0, MAX_CARDS);
}

/* ---------------------------------------------------------------------- stats */

/** A count as the site prints its instrumentation: at least two digits. */
export const stat = (count: number, label: string): AskStat => ({ value: String(count).padStart(2, "0"), label });

/* -------------------------------------------------------------------- actions */

/**
 * The destinations an answer can point at. Every href is a section of the homepage, a page of
 * this site or a file it serves — the same places the header and the sections link to.
 */
export const ACTIONS = {
  work: { label: "Explore all work", href: "/#work" },
  archive: { label: "Browse the archive", href: "/work" },
  garage: { label: "Open the Garage", href: "/#garage" },
  capabilities: { label: "View capabilities", href: "/#capabilities" },
  research: { label: "View research", href: "/#research" },
  experience: { label: "View experience", href: "/#experience" },
  about: { label: "Read the philosophy", href: "/#about" },
  contact: { label: "Go to contact", href: "/#contact" },
  resume: { label: "Open résumé", href: profile.resume.href },
} as const satisfies Record<string, AskAction>;

/** A project's own destination: its case study when it has one, otherwise its archive row. */
export const projectAction = (project: Project): AskAction =>
  project.caseStudy ? { label: "Open case study", href: projectRoute(project) } : ACTIONS.archive;

const ACTION_BY_TYPE: Partial<Record<KnowledgeType, AskAction>> = {
  profile: ACTIONS.about,
  philosophy: ACTIONS.about,
  skill: ACTIONS.capabilities,
  experience: ACTIONS.experience,
  education: ACTIONS.experience,
  achievement: ACTIONS.experience,
  now: ACTIONS.research,
  repo: ACTIONS.garage,
  contact: ACTIONS.contact,
};

const isProjectDoc = (doc: KnowledgeDoc): boolean => doc.type === "project" || doc.type === "case-study";

/**
 * Actions for an answer written from retrieved documents: the case studies it draws on first
 * (the subject project's before any other), then the section each cited document lives in.
 */
export function actionsFromDocs(docs: readonly KnowledgeDoc[], project?: Project): AskAction[] {
  const studies = new Map<string, string>();
  if (project?.caseStudy) studies.set(projectRoute(project), project.title);
  for (const doc of docs) {
    if (isProjectDoc(doc) && doc.href.startsWith("/work/") && !studies.has(doc.href)) studies.set(doc.href, doc.label.split(" / ")[0]);
  }
  // With one case study the label needs no name; with several, each says which it opens.
  const actions: AskAction[] = [...studies].map(([href, title]) => ({
    label: studies.size > 1 ? `Open ${title} case study` : "Open case study",
    href,
  }));

  const sections = [
    project && !project.caseStudy ? ACTIONS.archive : undefined,
    ...docs.map((doc) => (isProjectDoc(doc) ? (doc.href.startsWith("/work/") ? undefined : ACTIONS.archive) : ACTION_BY_TYPE[doc.type])),
  ];
  for (const action of sections) {
    if (action && !actions.some((existing) => existing.href === action.href)) actions.push(action);
  }
  return actions.slice(0, MAX_ACTIONS);
}

/* -------------------------------------------------------------------- related */

/** Distinct entries, first-seen order, capped at what the brief can show on one line or two. */
export function relatedFrom(...lists: (readonly string[])[]): string[] {
  const seen = new Set<string>();
  const related: string[] = [];
  for (const item of lists.flat()) {
    const key = item.toLowerCase();
    if (seen.has(key)) continue;
    seen.add(key);
    related.push(item);
  }
  return related.slice(0, MAX_RELATED);
}
