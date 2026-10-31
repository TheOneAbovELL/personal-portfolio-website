/**
 * The assistant's knowledge index.
 *
 * Built from the portfolio's own content modules, the résumé (src/content/resume.ts, which
 * mirrors /resume.pdf), the public GitHub and Codeforces data the site already shows, and the
 * READMEs of the programme and Garage repositories. A few hundred short documents at most,
 * so retrieval is lexical and in-memory.
 */

import {
  achievements,
  education,
  experience,
  formatMonth,
  formatRange,
  now,
  profile,
  research,
  site,
  skills,
  statusLabel,
  visibleProjects,
} from "@/content";
import type { CaseStudy, Project, TitledNote } from "@/content";
import { GITHUB_USER } from "@/content/garage";
import { resume } from "@/content/resume";
import { getCodeforces } from "@/lib/codeforces";
import type { CodeforcesData } from "@/lib/codeforces";
import { getGarage } from "@/lib/github";
import type { GarageRepo } from "@/lib/github";

import { githubSlug, loadReadmeDocs } from "./readme";
import type { ReadmeTarget } from "./readme";
import { joinList, normalize, stem, stemTokens } from "./text";
import type { KnowledgeDoc } from "./types";

export type CaseSection = keyof CaseStudy;

/** Case-study blocks in reading order, with the names used in citations and answers. */
export const CASE_SECTIONS: { key: CaseSection; label: string }[] = [
  { key: "problem", label: "Problem" },
  { key: "approach", label: "Approach" },
  { key: "architecture", label: "Architecture" },
  { key: "decisions", label: "Decisions" },
  { key: "reliability", label: "Reliability" },
  { key: "outcome", label: "Outcome" },
  { key: "limitations", label: "Limitations" },
  { key: "learnings", label: "Learnings" },
  { key: "next", label: "Next steps" },
];

export interface Entity {
  /** "project:<slug>", "repo:<name>" or "tech:<normalised name>". */
  id: string;
  kind: "project" | "repo" | "tech";
  name: string;
  /** Stemmed token phrases that identify the entity in a question. */
  aliases: string[];
}

export interface KnowledgeBase {
  docs: KnowledgeDoc[];
  entities: Entity[];
  /** Garage repositories, including those that also appear as archive projects. */
  repos: GarageRepo[];
  codeforces: CodeforcesData;
  builtAt: number;
}

export const projectEntityId = (slug: string) => `project:${slug}`;
export const repoEntityId = (name: string) => `repo:${name}`;

/** Case-study projects have a page; the rest are rows in the archive. */
export const projectRoute = (project: Project): string => (project.caseStudy ? `/work/${project.slug}` : "/work");

/** Status with its qualifier, without repeating the label when the note already starts with it. */
export function statusLine(project: Project): string {
  const label = statusLabel[project.status];
  if (!project.statusNote) return `${label}.`;
  return project.statusNote.toLowerCase().startsWith(label.toLowerCase())
    ? project.statusNote
    : `${label}. ${project.statusNote}`;
}

const isNotes = (block: string[] | TitledNote[]): block is TitledNote[] => typeof block[0] === "object";

export function sectionLines(block: string[] | TitledNote[]): string[] {
  return isNotes(block) ? block.map((note) => `${note.title}: ${note.detail}`) : block;
}

const repoNameFromUrl = (url: string | undefined): string | null => url?.split("/").filter(Boolean).pop() ?? null;

/* ------------------------------------------------------------------ documents */

function profileDocs(): KnowledgeDoc[] {
  const principleTitles = profile.principles.map((principle) => principle.title);
  return [
    {
      id: "profile",
      type: "profile",
      title: `About ${profile.name}`,
      label: "About Omjee",
      href: "/#about",
      importance: 1.15,
      tags: ["about", "who", "engineer", "introduction", "bio", ...profile.roles],
      text: [
        site.description,
        `His portfolio describes him with these roles: ${profile.roles.join(", ")}.`,
        `In his own words: "${profile.statement}"`,
        `He also writes: "${profile.about.lead}"`,
        ...profile.about.paragraphs.map((paragraph) => `From his about section: "${paragraph}"`),
      ].join("\n"),
    },
    {
      id: "philosophy:principles",
      type: "philosophy",
      title: "Working principles",
      label: "About / Principles",
      href: "/#about",
      importance: 1,
      tags: ["philosophy", "principles", "approach", "values", "mindset", ...principleTitles, ...profile.loop],
      text: [
        `Omjee's working principles are ${joinList(principleTitles)}.`,
        ...profile.principles.map((principle) => `${principle.title} — in his words: "${principle.detail}"`),
        `His working loop is ${profile.loop.join(", ")}.`,
      ].join("\n"),
    },
    {
      id: "philosophy:layers",
      type: "philosophy",
      title: "Layers Omjee works across",
      label: "About / Layers",
      href: "/#about",
      importance: 0.95,
      tags: ["layers", "full stack", "end to end", ...profile.layers.map((layer) => layer.label)],
      text: [
        `Omjee works across ${profile.layers.length} layers, in order: ${joinList(profile.layers.map((layer) => layer.label))}.`,
        ...profile.layers.map((layer) => `${layer.label}: ${layer.note}.`),
      ].join("\n"),
    },
  ];
}

function skillDocs(): KnowledgeDoc[] {
  return skills.map((domain) => ({
    id: `skill:${domain.id}`,
    type: "skill",
    title: domain.title,
    label: `Capabilities / ${domain.title}`,
    href: "/#capabilities",
    importance: 1,
    tags: ["skills", "capabilities", "technologies", domain.title, ...domain.items],
    text: [
      `${domain.title} — ${domain.summary}`,
      `Technologies and topics Omjee lists under ${domain.title}: ${domain.items.join(", ")}.`,
      ...domain.evidence.map((evidence) => `Evidence from ${evidence.source}: ${evidence.note}.`),
    ].join("\n"),
  }));
}

function projectDocs(project: Project): KnowledgeDoc[] {
  const entity = projectEntityId(project.slug);
  const href = projectRoute(project);
  const caveat = project.status === "research" && project.statusNote ? `Status note: ${project.statusNote}` : null;

  const overview: KnowledgeDoc = {
    id: `project:${project.slug}`,
    type: "project",
    title: project.title,
    label: `${project.title} / Overview`,
    href,
    importance: project.featured ? 1.2 : 1,
    entity,
    tags: [project.title, project.slug, project.category, project.discipline ?? "", "project", ...project.stack].filter(Boolean),
    text: [
      `${project.title}${project.fullTitle ? ` (${project.fullTitle})` : ""}: ${project.tagline}.`,
      project.summary,
      `Status: ${statusLine(project)}`,
      project.discipline ? `Discipline: ${project.discipline}.` : null,
      `Year: ${project.year}.`,
      project.role ? `Omjee's role: ${project.role}.` : null,
      project.context ? `Context: ${project.context}.` : null,
      `Technology stack: ${project.stack.join(", ")}.`,
      ...(project.facts ?? []).map((fact) => `${fact.label}: ${fact.value}.`),
      project.links.repo ? `Repository: ${project.links.repo}` : null,
      project.links.demo ? `Live demo: ${project.links.demo}` : null,
      project.links.paper ? `Paper: ${project.links.paper}` : null,
    ]
      .filter((line): line is string => Boolean(line))
      .join("\n"),
  };

  const study = project.caseStudy;
  if (!study) return [overview];

  const blocks: KnowledgeDoc[] = [];
  for (const { key, label } of CASE_SECTIONS) {
    const block = study[key];
    if (!block || block.length === 0) continue;
    blocks.push({
      id: `case:${project.slug}:${key}`,
      type: "case-study",
      title: `${project.title} — ${label}`,
      label: `${project.title} / ${label}`,
      href,
      importance: key === "problem" || key === "approach" || key === "architecture" ? 1.05 : 0.97,
      entity,
      tags: [project.title, project.slug, label, key, "case study"],
      text: [...sectionLines(block), ...(caveat ? [caveat] : [])].join("\n"),
    });
  }
  return [overview, ...blocks];
}

function experienceDocs(): KnowledgeDoc[] {
  const roles: KnowledgeDoc[] = experience.map((role) => ({
    id: `experience:${role.id}`,
    type: "experience",
    title: `${role.role} — ${role.organization}`,
    label: `Experience / ${role.organization}`,
    href: "/#experience",
    importance: 1.1,
    tags: ["experience", role.kind, role.role, role.organization, role.unit ?? "", ...role.stack].filter(Boolean),
    text: [
      `${role.role} at ${role.organization}${role.unit ? ` (${role.unit})` : ""}, ${formatRange(role.start, role.end)}.`,
      role.summary,
      ...role.highlights.map((highlight) =>
        highlight.links?.length
          ? `${highlight.text} (pull requests ${highlight.links.map((link) => link.label).join(", ")})`
          : highlight.text,
      ),
      `Technologies used in this role: ${role.stack.join(", ")}.`,
    ].join("\n"),
  }));

  const degrees: KnowledgeDoc[] = education.map((item) => ({
    id: `education:${item.id}`,
    type: "education",
    title: `${item.degree}, ${item.institution}`,
    label: `Education / ${item.institution}`,
    href: "/#experience",
    importance: 1.05,
    tags: ["education", "degree", "university", "college", "student", item.degree, item.field, item.institution],
    text: educationSentence(item, "Omjee"),
  }));

  return [...roles, ...degrees];
}

export function educationSentence(item: (typeof education)[number], subject: string, also = false): string {
  const verb = item.end ? `${also ? "also " : ""}completed` : `is ${also ? "also " : ""}pursuing`;
  const when = item.end ? formatRange(item.start, item.end) : `since ${formatMonth(item.start)}`;
  return `${subject} ${verb} a ${item.degree} in ${item.field} at ${item.institution} (${when}).`;
}

export function codeforcesSentence(codeforces: CodeforcesData): string {
  return `On Codeforces, Omjee (handle ${codeforces.handle}) holds the rank of ${codeforces.rank} with a current rating of ${codeforces.rating}.`;
}

function recognitionDocs(codeforces: CodeforcesData): KnowledgeDoc[] {
  const listed: KnowledgeDoc[] = achievements.map((achievement) => ({
    id: `achievement:${achievement.id}`,
    type: "achievement",
    title: achievement.title,
    label: `Recognition / ${achievement.title}`,
    href: "/#experience",
    importance: 1,
    tags: ["achievement", "recognition", "award", achievement.title],
    text: `${achievement.title}: ${achievement.detail}`,
  }));
  return [
    ...listed,
    {
      id: "achievement:codeforces",
      type: "achievement",
      title: "Codeforces",
      label: "Recognition / Codeforces",
      href: "/#experience",
      importance: 1,
      tags: ["codeforces", "competitive programming", "rating", "contests", "problem solving", codeforces.rank],
      text: codeforcesSentence(codeforces),
    },
  ];
}

function currentDocs(): KnowledgeDoc[] {
  const docs: KnowledgeDoc[] = [
    {
      id: "now",
      type: "now",
      title: "What Omjee is doing now",
      label: "Research / Current focus",
      href: "/#research",
      importance: 1.05,
      tags: ["now", "current", "currently", "focus", "interests", ...now.groups.map((group) => group.label)],
      text: [
        `What Omjee is working on, as of ${formatMonth(now.updated)}.`,
        ...now.groups.map(
          (group) =>
            `${group.label}: ${group.items.map((item) => (item.note ? `${item.title} (${item.note.replace(/\.$/, "")})` : item.title)).join("; ")}.`,
        ),
      ].join("\n"),
    },
  ];

  const subject = visibleProjects().find((project) => project.slug === research.project);
  docs.push({
    id: "research",
    type: "now",
    title: "Research thread",
    label: subject ? `Research / ${subject.title}` : "Research",
    href: "/#research",
    importance: 1.05,
    entity: subject ? projectEntityId(subject.slug) : undefined,
    tags: ["research", "researching", "study", "pipeline", ...(subject ? [subject.title] : [])],
    text: [
      research.intro,
      `How a recording moves through the research pipeline: ${research.flow.map((step) => `${step.label} (${step.note})`).join(", then ")}.`,
      research.disclaimer,
    ].join("\n"),
  });
  return docs;
}

function repoText(repo: GarageRepo): string {
  return [
    `${repo.title} is one of Omjee's public GitHub repositories, filed under ${repo.category}${repo.language ? ` and written mainly in ${repo.language}` : ""}.`,
    repo.description ? repo.description.replace(/([^.!?])$/, "$1.") : "The portfolio does not include a description for it yet.",
    repo.fork ? "It is a fork kept for upstream contributions." : null,
    repo.homepage ? `Live at ${repo.homepage}` : null,
    `Last pushed on ${repo.pushedAt}.`,
  ]
    .filter((line): line is string => Boolean(line))
    .join("\n");
}

function garageDocs(repos: GarageRepo[], projectRepoNames: Set<string>): KnowledgeDoc[] {
  const standalone = repos.filter((repo) => !projectRepoNames.has(repo.name.toLowerCase()));
  const docs: KnowledgeDoc[] = standalone.map((repo) => ({
    id: `repo:${repo.name}`,
    type: "repo",
    title: repo.title,
    label: `Garage / ${repo.title}`,
    href: repo.url,
    importance: 0.8,
    entity: repoEntityId(repo.name),
    tags: [repo.title, repo.name, repo.category, repo.language ?? "", "repository", "github", "garage"].filter(Boolean),
    text: repoText(repo),
  }));

  if (repos.length > 0) {
    docs.push({
      id: "garage",
      type: "repo",
      title: "Garage — other public repositories",
      label: "Garage",
      href: "/#garage",
      importance: 0.9,
      tags: ["garage", "other projects", "side projects", "small projects", "repositories", "github", "experiments"],
      text: [
        `Beyond the featured case studies, Omjee's public GitHub (${GITHUB_USER}) lists ${repos.length} other repositories.`,
        `They are: ${repos.map((repo) => `${repo.title} (${[repo.category, repo.language].filter(Boolean).join(", ")})`).join("; ")}.`,
      ].join("\n"),
    });
  }
  return docs;
}

function contactDocs(): KnowledgeDoc[] {
  return [
    {
      id: "contact",
      type: "contact",
      title: "Contact",
      label: "Contact",
      href: "/#contact",
      importance: 1.1,
      tags: ["contact", "email", "reach", "socials", ...profile.socials.map((social) => social.label)],
      text: [
        `Omjee can be reached by email at ${profile.email}.`,
        ...profile.socials.map((social) => `${social.label}: ${social.handle} — ${social.href}`),
      ].join("\n"),
    },
    {
      id: "availability",
      type: "contact",
      title: "Availability",
      label: "Contact / Availability",
      href: "/#contact",
      importance: 1.1,
      tags: ["availability", "available", "hiring", "internship", "roles", "opportunities", "open to work"],
      text: `Availability: ${profile.availability.label}.\n${profile.availability.note}`,
    },
    {
      id: "resume",
      type: "contact",
      title: "Résumé",
      label: "Résumé",
      href: profile.resume.href,
      importance: 1,
      tags: ["resume", "cv", "pdf", "download"],
      text: `Omjee's résumé is available from the portfolio as a PDF (${profile.resume.fileName}).`,
    },
  ];
}

/* --------------------------------------------------------------------- résumé */

const RESUME_TAGS = ["resume", "cv", "résumé"];

/** CGPA sentences, shared with the direct answers. */
export function cgpaSentence(subject = "His résumé lists"): string {
  return `${subject} a CGPA of ${joinList(resume.education.map((item) => `${item.cgpa} in the ${item.degree} at ${item.short}`))}.`;
}

/**
 * The résumé, one section per document, cited as "Résumé / <section>" and linked to the PDF.
 * Project entries carry their project's entity, so naming a project also reaches its résumé
 * lines.
 */
function resumeDocs(projects: Project[]): KnowledgeDoc[] {
  const href = resume.href;
  const visible = new Set(projects.map((project) => project.slug));
  return [
    {
      id: "resume:summary",
      type: "resume",
      title: "Résumé summary",
      label: "Résumé / Summary",
      href,
      importance: 1.05,
      tags: [...RESUME_TAGS, "summary", "profile", "seeking", "internships"],
      text: `The professional summary on Omjee's résumé: ${resume.summary}`,
    },
    {
      id: "resume:education",
      type: "resume",
      title: "Résumé education and CGPA",
      label: "Résumé / Education",
      href,
      importance: 1.1,
      tags: [...RESUME_TAGS, "education", "cgpa", "gpa", "grades", "marks", "degree", ...resume.education.map((item) => item.short)],
      text: [
        ...resume.education.map(
          (item) => `${item.degree}, ${item.field} at ${item.institution} (${item.period}), CGPA ${item.cgpa}.`,
        ),
        cgpaSentence("The résumé lists"),
      ].join("\n"),
    },
    ...resume.experience.map(
      (role): KnowledgeDoc => ({
        id: `resume:experience:${normalize(role.short).replace(/ /g, "-")}`,
        type: "resume",
        title: `Résumé: ${role.role}, ${role.organization}`,
        label: `Résumé / Experience — ${role.short}`,
        href,
        importance: 1,
        tags: [...RESUME_TAGS, "experience", role.role, role.organization, role.short],
        text: [`${role.role} at ${role.organization} (${role.period}).`, ...role.bullets].join("\n"),
      }),
    ),
    ...resume.projects.map(
      (entry): KnowledgeDoc => ({
        id: `resume:project:${entry.slug ?? normalize(entry.short).replace(/ /g, "-")}`,
        type: "resume",
        title: `Résumé: ${entry.title}`,
        label: `Résumé / Projects — ${entry.short}`,
        href,
        importance: 1,
        entity: entry.slug && visible.has(entry.slug) ? projectEntityId(entry.slug) : undefined,
        tags: [...RESUME_TAGS, "project", entry.short, ...entry.stack],
        text: [
          `${entry.title}${entry.note ? ` (${entry.note})` : ""}.`,
          ...entry.bullets,
          `Tech stack on the résumé: ${entry.stack.join(", ")}.`,
          entry.live ? `Live: ${entry.live}.` : null,
        ]
          .filter((line): line is string => Boolean(line))
          .join("\n"),
      }),
    ),
    {
      id: "resume:achievements",
      type: "resume",
      title: "Résumé achievements",
      label: "Résumé / Achievements",
      href,
      importance: 1.05,
      tags: [...RESUME_TAGS, "achievements", "codeforces", "rating", "gssoc", "rank", "awards"],
      text: `Achievements on Omjee's résumé:\n${resume.achievements.join("\n")}`,
    },
    {
      id: "resume:skills",
      type: "resume",
      title: "Résumé technical skills",
      label: "Résumé / Skills",
      href,
      importance: 1.05,
      tags: [...RESUME_TAGS, "skills", "technical skills", "technologies", ...resume.skills.map((group) => group.group)],
      text: [
        `Technical skills on Omjee's résumé, in ${resume.skills.length} groups.`,
        ...resume.skills.map((group) => `${group.group}: ${group.items.join(", ")}.`),
      ].join("\n"),
    },
  ];
}

/** Every repository whose README is indexed: the programmes' and the Garage's. */
function readmeTargets(projects: Project[], repos: GarageRepo[], projectRepoNames: Set<string>): ReadmeTarget[] {
  const targets: ReadmeTarget[] = [];
  for (const project of projects) {
    const slug = githubSlug(project.links.repo);
    if (slug) targets.push({ slug, title: project.title, url: project.links.repo as string, entity: projectEntityId(project.slug) });
  }
  for (const repo of repos) {
    if (projectRepoNames.has(repo.name.toLowerCase())) continue;
    const slug = githubSlug(repo.url);
    if (slug) targets.push({ slug, title: repo.title, url: repo.url, entity: repoEntityId(repo.name) });
  }
  return targets;
}

/* ------------------------------------------------------------------- entities */

/** Words too common in repository names to identify one on their own. */
const GENERIC_NAME_WORDS = new Set(
  ["research", "system", "project", "portfolio", "engine", "labs", "submissions", "detector", "news", "feed", "india", "indian", "option", "fork", "working", "backend"].map(stem),
);

function aliasesFor(name: string, options: { bigrams: boolean }): string[] {
  const tokens = stemTokens(name);
  if (tokens.length === 0) return [];
  const aliases = new Set<string>([tokens.join(" ")]);
  if (tokens.length > 1) aliases.add(stem(normalize(name).replace(/ /g, "")));
  if (options.bigrams && tokens.length > 2) {
    for (let index = 0; index < tokens.length - 1; index += 1) {
      const pair = [tokens[index], tokens[index + 1]];
      if (!pair.every((token) => GENERIC_NAME_WORDS.has(token))) aliases.add(pair.join(" "));
    }
  }
  return [...aliases].filter((alias) => alias.length > 2);
}

function buildEntities(projects: Project[], repos: GarageRepo[], projectRepoNames: Set<string>): Entity[] {
  const entities: Entity[] = [];

  for (const project of projects) {
    const repoName = repoNameFromUrl(project.links.repo);
    entities.push({
      id: projectEntityId(project.slug),
      kind: "project",
      name: project.title,
      aliases: [
        ...new Set([
          ...aliasesFor(project.title, { bigrams: true }),
          ...aliasesFor(project.slug, { bigrams: false }),
          ...(project.fullTitle ? aliasesFor(project.fullTitle, { bigrams: false }) : []),
          ...(repoName ? aliasesFor(repoName, { bigrams: false }) : []),
        ]),
      ],
    });
  }

  for (const repo of repos) {
    if (projectRepoNames.has(repo.name.toLowerCase())) continue;
    entities.push({
      id: repoEntityId(repo.name),
      kind: "repo",
      name: repo.title,
      aliases: [...new Set([...aliasesFor(repo.title, { bigrams: true }), ...aliasesFor(repo.name, { bigrams: false })])],
    });
  }

  const technologies = new Map<string, string>();
  const addTechnology = (raw: string) => {
    for (const part of raw.split(" / ")) {
      const key = stemTokens(part).join(" ");
      if (key.length > 1 && !technologies.has(key)) technologies.set(key, part.trim());
    }
  };
  skills.forEach((domain) => domain.items.forEach(addTechnology));
  projects.forEach((project) => project.stack.forEach(addTechnology));
  experience.forEach((role) => role.stack.forEach(addTechnology));
  for (const [key, name] of technologies) {
    entities.push({ id: `tech:${key}`, kind: "tech", name, aliases: aliasesFor(name, { bigrams: false }) });
  }

  return entities;
}

/* ---------------------------------------------------------------------- build */

async function build(): Promise<KnowledgeBase> {
  const [garage, codeforces] = await Promise.all([getGarage(), getCodeforces()]);
  const projects = visibleProjects();
  const projectRepoNames = new Set(
    projects.map((project) => repoNameFromUrl(project.links.repo)?.toLowerCase()).filter((name): name is string => Boolean(name)),
  );
  const readmes = await loadReadmeDocs(readmeTargets(projects, garage.repos, projectRepoNames));

  const docs: KnowledgeDoc[] = [
    ...profileDocs(),
    ...skillDocs(),
    ...projects.flatMap(projectDocs),
    ...experienceDocs(),
    ...recognitionDocs(codeforces),
    ...currentDocs(),
    ...garageDocs(garage.repos, projectRepoNames),
    ...contactDocs(),
    ...resumeDocs(projects),
    ...readmes,
  ];

  return {
    docs,
    entities: buildEntities(projects, garage.repos, projectRepoNames),
    repos: garage.repos,
    codeforces,
    builtAt: Date.now(),
  };
}

const REFRESH_MS = 60 * 60 * 1000;

let cached: KnowledgeBase | null = null;
let pending: Promise<KnowledgeBase> | null = null;

/**
 * The knowledge base, rebuilt at most once an hour. Concurrent callers share one build, and a
 * failed rebuild keeps serving the previous copy.
 */
export async function loadKnowledgeBase(): Promise<KnowledgeBase> {
  if (cached && Date.now() - cached.builtAt < REFRESH_MS) return cached;
  pending ??= build()
    .then((fresh) => {
      cached = fresh;
      return fresh;
    })
    .catch((error: unknown) => {
      if (cached) return cached;
      throw error;
    })
    .finally(() => {
      pending = null;
    });
  return pending;
}

export async function buildKnowledge(): Promise<KnowledgeDoc[]> {
  return (await loadKnowledgeBase()).docs;
}
