/**
 * Direct answers: sentences assembled from the content for a recognised intent.
 *
 * Nothing here states a fact that is not a field in `src/content/*` (or the public GitHub and
 * Codeforces data the site already shows). Omjee's own first-person copy is quoted, never
 * re-voiced, because the assistant is a guide to the portfolio and not Omjee.
 */

import {
  achievements,
  archiveProjects,
  education,
  experience,
  featuredProjects,
  formatRange,
  now,
  profile,
  research,
  site,
  skills,
  visibleProjects,
} from "@/content";
import type { Evidence, Experience, Project, SkillDomain, TitledNote } from "@/content";

import { resume } from "@/content/resume";

import type { Intent, ResumeSection } from "./intents";
import type { GarageRepo } from "@/lib/github";

import type { Entity, KnowledgeBase } from "./knowledge";
import { CASE_SECTIONS, cgpaSentence, codeforcesSentence, educationSentence, projectEntityId, sectionLines, statusLine } from "./knowledge";
import type { CaseSection } from "./knowledge";
import { ACTIONS, MAX_CARDS, experienceCard, projectAction, projectCard, relatedFrom, repoCard, skillCard, stat } from "./present";
import { generalFollowUps, getSuggestions, projectFollowUps } from "./suggestions";
import type { ProjectAspect } from "./suggestions";
import {
  ensurePeriod,
  fitToBudget,
  joinList,
  lowerFirst,
  mentions,
  normalize,
  splitSentences,
  stemTokens,
  stripTrailingPeriod,
  synonymsOf,
  terms,
  wordCount,
} from "./text";
import type { AskAction, AskCard, AskStat } from "./types";

export const NOT_DOCUMENTED = "That information isn't currently documented in Omjee's public portfolio.";

export const REDIRECT =
  "This assistant only covers Omjee R Giri's portfolio, so it can't help with that — try asking about his projects, research, skills or experience.";

export interface Composed {
  answer: string;
  /** Ids of the knowledge documents the answer was assembled from. */
  sourceIds: string[];
  cards: AskCard[];
  followUps: string[];
  /** Counted from the content (or fetched with it); see `AskResponse.stats`. */
  stats?: AskStat[];
  related?: string[];
  actions?: AskAction[];
}

/** Soft ceiling for a composed answer, in words. */
const BUDGET = 115;

const paragraphs = (...parts: (string | null | false | undefined)[]): string =>
  parts.filter((part): part is string => Boolean(part)).join("\n\n");

const plural = (count: number, singular: string, pluralForm = `${singular}s`) => `${count} ${count === 1 ? singular : pluralForm}`;

const findProject = (slug: string): Project | undefined => visibleProjects().find((project) => project.slug === slug);

/* ------------------------------------------------------------------- projects */

const researchCaveat = (project: Project): string | null =>
  project.status === "research" && project.statusNote ? `Note: ${project.statusNote}` : null;

const SECTION_INTRO: Partial<Record<CaseSection, (title: string) => string>> = {
  reliability: (title) => `How ${title} is tested and kept reliable:`,
  outcome: (title) => `Where ${title} stands today:`,
  limitations: (title) => `Known limitations of ${title}, as stated in its case study:`,
  learnings: (title) => `What Omjee took away from building ${title}:`,
  next: (title) => `Planned next steps for ${title}:`,
};

function projectOverview(project: Project): string {
  const role = project.role ? `Omjee's role: ${project.role}${project.context ? ` (${project.context})` : ""}.` : null;
  return paragraphs(project.summary, [`Status: ${statusLine(project)}`, role].filter(Boolean).join(" "));
}

const namesTechnology = (raw: string, technology: Entity): boolean =>
  raw.split(" / ").some((part) => technology.aliases.includes(stemTokens(part).join(" ")));

function projectStack(project: Project, technology: Entity | null): string {
  const stack = `${project.title} is built with ${joinList(project.stack)}.`;
  if (!technology) return stack;
  const listed = project.stack.some((item) => namesTechnology(item, technology));
  return listed
    ? `Yes — ${technology.name} is part of the ${project.title} stack. ${stack}`
    : `${technology.name} is not listed in the ${project.title} stack. ${stack}`;
}

function projectLinks(project: Project): string {
  const { repo, demo, paper } = project.links;
  const lines = [
    repo ? `The ${project.title} source code is on GitHub at ${repo}.` : null,
    demo ? `A live demo is at ${demo}.` : null,
    paper ? `The paper is at ${paper}.` : null,
  ].filter((line): line is string => line !== null);
  if (lines.length > 0) return lines.join(" ");

  const note = project.caseStudy?.limitations?.find((item) => /\b(public|open[- ]source|repository|code)\b/i.test(item));
  return [`No public repository or demo is listed for ${project.title} in the portfolio.`, note ? `Its case study notes: "${note}"` : null]
    .filter(Boolean)
    .join(" ");
}

function architectureSection(project: Project, parts: TitledNote[]): string {
  const lead = `${project.title} is organised into ${plural(parts.length, "part")}: ${joinList(parts.map((part) => part.title))}.`;
  const { kept, truncated } = fitToBudget(sectionLines(parts), BUDGET - 35);
  return paragraphs(lead, kept.map(ensurePeriod).join(" "), truncated && "The full breakdown is in the case study.");
}

/** Case-study blocks a project has, named the way a sentence would name them. */
const coveredSections = (project: Project): string[] =>
  CASE_SECTIONS.filter(({ key }) => project.caseStudy?.[key]?.length).map(({ label }) => label.toLowerCase());

/**
 * The reasoning behind a project's design, from the `decisions` block of its case study:
 * two or three decisions, each with its rationale. `keyTerms` narrows the answer to the
 * decisions that mention them; when none does, this returns null so the question can go to
 * retrieval instead of being answered with unrelated decisions.
 */
function decisionsSection(project: Project, keyTerms: string[]): string | null {
  const decisions = project.caseStudy?.decisions ?? [];
  if (decisions.length === 0) {
    const covered = coveredSections(project);
    return paragraphs(
      `Design decisions for ${project.title} aren't currently documented in Omjee's public portfolio.`,
      covered.length
        ? `Its case study does cover its ${joinList(covered)}.`
        : `What the portfolio does say about ${project.title}: ${project.summary}`,
    );
  }

  let relevant = decisions;
  if (keyTerms.length > 0) {
    const scored = decisions
      .map((decision, position) => {
        const present = new Set(terms(`${decision.title} ${decision.detail}`));
        const score = keyTerms.filter((term) => present.has(term) || synonymsOf(term).some((synonym) => present.has(synonym))).length;
        return { decision, position, score };
      })
      .filter((item) => item.score > 0)
      .sort((a, b) => b.score - a.score || a.position - b.position);
    if (scored.length === 0) return null;
    relevant = scored.map((item) => item.decision);
  }

  const shown = fitToBudget(sectionLines(relevant.slice(0, 3)), 100).kept;
  const others = decisions.filter((decision) => !relevant.slice(0, shown.length).includes(decision));
  const lead =
    keyTerms.length > 0
      ? `From the design decisions recorded in the ${project.title} case study:`
      : `The ${project.title} case study records why it is built the way it is.`;
  return paragraphs(
    keyTerms.length > 0 ? `${lead} ${shown.map(ensurePeriod).join(" ")}` : lead,
    keyTerms.length > 0 ? null : shown.map(ensurePeriod).join(" "),
    others.length > 0 && `It also records: ${others.map((decision) => decision.title).join("; ")}.`,
  );
}

function textSection(project: Project, section: CaseSection, lines: string[]): string {
  const intro = SECTION_INTRO[section]?.(project.title);
  const { kept, truncated } = fitToBudget(lines, BUDGET - 15);
  const more = truncated ? "More detail is in the full case study." : null;
  return intro ? paragraphs(`${intro} ${kept.join(" ")}`, more) : paragraphs(...kept, more);
}

function projectStanding(project: Project, wordBudget: number): string {
  const outcome = project.caseStudy?.outcome;
  return outcome?.length
    ? `What the portfolio does say about where ${project.title} stands: ${fitToBudget(outcome, wordBudget).kept.join(" ")}`
    : `What the portfolio does say about ${project.title}: ${project.summary}`;
}

/** Sentences from the project's own documents that contain a number and every key term. */
function quantifiedFacts(project: Project, keyTerms: string[], kb: KnowledgeBase): { sentences: string[]; sourceIds: string[] } {
  if (keyTerms.length === 0) return { sentences: [], sourceIds: [] };
  const sentences: string[] = [];
  const sourceIds: string[] = [];
  for (const doc of kb.docs) {
    if (doc.entity !== projectEntityId(project.slug)) continue;
    for (const sentence of splitSentences(doc.text)) {
      if (!/\d/.test(sentence) || sentences.length >= 2) continue;
      const present = new Set(terms(sentence));
      const matchesAll = keyTerms.every((term) => present.has(term) || synonymsOf(term).some((synonym) => present.has(synonym)));
      if (matchesAll) {
        sentences.push(ensurePeriod(sentence));
        if (!sourceIds.includes(doc.id)) sourceIds.push(doc.id);
      }
    }
  }
  return { sentences, sourceIds };
}

/** Where a project answer leads: its case study, the research block if it is the study, then its code. */
function projectActions(project: Project): AskAction[] {
  const { repo, demo } = project.links;
  return [
    projectAction(project),
    project.slug === research.project ? ACTIONS.research : null,
    repo ? { label: "View repository", href: repo } : null,
    demo ? { label: "Open live demo", href: demo } : null,
  ].filter((action): action is AskAction => action !== null);
}

function composeProject(intent: Extract<Intent, { kind: "project" }>, kb: KnowledgeBase): Composed | null {
  const project = findProject(intent.slug);
  if (!project) return null;

  const overviewId = `project:${project.slug}`;
  const study = project.caseStudy;
  const aspect: ProjectAspect = intent.aspect === "more" ? (study?.approach.length ? "approach" : "overview") : intent.aspect;
  const done = (answer: string, sourceIds: string[], covered: ProjectAspect = aspect): Composed => ({
    answer,
    sourceIds,
    cards: [projectCard(project)],
    followUps: [...projectFollowUps(project, covered), ...generalFollowUps()],
    related: relatedFrom(project.stack),
    actions: projectActions(project),
  });

  if (aspect === "overview") return done(projectOverview(project), [overviewId]);
  if (aspect === "links") return done(projectLinks(project), [overviewId]);

  if (aspect === "stack") {
    const technology = intent.technology;
    if (technology && !project.stack.some((item) => namesTechnology(item, technology))) {
      // Not a stack entry, but the case study talks about it ("Does Legal Lens use RAG?"):
      // "not listed in the stack" would mislead, so let retrieval answer from the text.
      const wanted = technology.aliases[0]?.split(" ") ?? [];
      const discussed = kb.docs.some((doc) => doc.entity === projectEntityId(project.slug) && mentions(doc.text, wanted));
      if (discussed) return null;
    }
    return done(paragraphs(projectStack(project, technology), researchCaveat(project)), [overviewId]);
  }

  if (aspect === "status") {
    const limitations = study?.limitations;
    return done(
      paragraphs(
        `Status of ${project.title}: ${statusLine(project)}`,
        limitations?.length ? textSection(project, "limitations", limitations) : projectStanding(project, 70),
      ),
      [overviewId, `case:${project.slug}:limitations`],
      "limitations",
    );
  }

  if (aspect === "metrics") {
    const facts = quantifiedFacts(project, intent.keyTerms, kb);
    if (facts.sentences.length > 0) {
      return done(paragraphs(`From the ${project.title} case study: ${facts.sentences.join(" ")}`, researchCaveat(project)), facts.sourceIds);
    }
    return done(
      paragraphs(NOT_DOCUMENTED, projectStanding(project, 70), researchCaveat(project)),
      [`case:${project.slug}:outcome`, overviewId],
      "outcome",
    );
  }

  if (aspect === "decisions") {
    const reasoning = decisionsSection(project, intent.keyTerms);
    if (!reasoning) {
      // "Why Groq?" — a stack entry no recorded decision explains. Say that the reasoning is
      // missing rather than letting retrieval answer "why" with the stack list.
      const entry = project.stack.find((item) => mentions(item, intent.keyTerms));
      const recorded = study?.decisions ?? [];
      if (!entry || recorded.length === 0) return null;
      return done(
        paragraphs(
          `Why ${entry} was chosen for ${project.title} isn't currently documented in Omjee's public portfolio. It is listed in the project's stack, without a recorded rationale.`,
          `The design decisions the case study does record: ${recorded.map((decision) => decision.title).join("; ")}.`,
          researchCaveat(project),
        ),
        [`case:${project.slug}:decisions`, overviewId],
      );
    }
    const ids = study?.decisions?.length ? [`case:${project.slug}:decisions`, overviewId] : [overviewId];
    return done(paragraphs(reasoning, researchCaveat(project)), ids);
  }

  let body: string | null = null;
  if (aspect === "architecture") {
    const parts = study?.architecture;
    if (parts?.length) body = architectureSection(project, parts);
  } else {
    const lines = study?.[aspect];
    if (lines?.length) body = textSection(project, aspect, lines);
  }
  if (!body) {
    // The block was asked for by name but this project does not have one.
    return done(paragraphs(NOT_DOCUMENTED, `What the portfolio does say about ${project.title}: ${project.summary}`), [overviewId], "overview");
  }
  const withStatus = aspect === "outcome" ? paragraphs(body, `Status: ${statusLine(project)}`) : paragraphs(body, researchCaveat(project));
  return done(withStatus, [`case:${project.slug}:${aspect}`, overviewId]);
}

function composeRepo(name: string, kb: KnowledgeBase): Composed | null {
  const repo = kb.repos.find((candidate) => candidate.name === name);
  if (!repo) return null;
  const description = repo.description ? ensurePeriod(repo.description) : "The portfolio does not include a description for it yet.";
  return {
    answer: paragraphs(
      `${repo.title} is one of Omjee's public GitHub repositories, filed under ${repo.category}${repo.language ? ` and written mainly in ${repo.language}` : ""}. ${description}`,
      `It was last pushed on ${repo.pushedAt}${repo.homepage ? ` and is live at ${repo.homepage}` : ""}. The code is at ${repo.url}.`,
    ),
    sourceIds: [`repo:${repo.name}`, "garage"],
    cards: [repoCard(repo)],
    followUps: ["What other projects has he built?", ...generalFollowUps()],
    related: relatedFrom([repo.category, ...(repo.language ? [repo.language] : [])]),
    actions: [ACTIONS.garage, { label: "View repository", href: repo.url }, ...(repo.homepage ? [{ label: "Open live demo", href: repo.homepage }] : [])],
  };
}

/* --------------------------------------------------------------------- garage */

/**
 * Everything smaller than a programme, counted once: an archive project and a Garage
 * repository are the same build when the archive entry links to that repository.
 */
function otherBuilds(kb: KnowledgeBase): { archive: Project[]; standalone: GarageRepo[]; total: number } {
  const archive = archiveProjects();
  const archiveRepos = new Set(archive.map((project) => project.links.repo?.toLowerCase()).filter(Boolean));
  const standalone = kb.repos.filter((repo) => !archiveRepos.has(repo.url.toLowerCase()));
  return { archive, standalone, total: archive.length + standalone.length };
}

const names = (list: { title: string }[], max = 6): string =>
  list.length > max ? `${list.slice(0, max).map((item) => item.title).join(", ")} and ${list.length - max} more` : joinList(list.map((item) => item.title));

function composeGarage(intent: Extract<Intent, { kind: "garage" }>, kb: KnowledgeBase): Composed {
  const featured = featuredProjects();
  const { language, category } = intent;
  const repos = kb.repos.filter((repo) => (!language || repo.language === language) && (!category || repo.category === category));

  const sourceIds = ["garage", ...repos.slice(0, 3).map((repo) => `repo:${repo.name}`)];
  const cards = repos.slice(0, MAX_CARDS).map(repoCard);
  const followUps = [repos[0] ? `What is ${repos[0].title}?` : null, ...generalFollowUps()].filter((item): item is string => item !== null);
  const actions = [ACTIONS.garage, ACTIONS.archive];

  if (!language && !category) {
    const { archive, standalone, total } = otherBuilds(kb);
    const archiveLine = archive.length
      ? `Beyond the ${plural(featured.length, "featured case study", "featured case studies")}, the portfolio's archive lists ${joinList(archive.map((project) => project.title))}.`
      : null;
    const repoLine = standalone.length
      ? `His public GitHub also has ${plural(standalone.length, "smaller repository", "smaller repositories")}, including ${names(standalone, 5)}.`
      : null;
    return {
      answer: paragraphs(archiveLine, repoLine) || "No other public projects are currently listed in Omjee's portfolio.",
      sourceIds: [...sourceIds, ...archive.slice(0, 2).map((project) => `project:${project.slug}`)],
      cards,
      followUps,
      stats: total
        ? [
            stat(total, "Other builds"),
            stat(archive.length, "In the archive"),
            stat(new Set(kb.repos.map((repo) => repo.category)).size, "Garage categories"),
          ]
        : undefined,
      actions,
    };
  }

  const filter = [language ? `written mainly in ${language}` : null, category ? `filed under ${category}` : null].filter(Boolean).join(" and ");
  const flagship =
    language && !intent.onlySmall ? featured.filter((project) => project.stack.some((item) => item.toLowerCase() === language.toLowerCase())) : [];
  const flagshipLine = flagship.length
    ? `Among the featured projects, ${joinList(flagship.map((project) => project.title))} ${flagship.length === 1 ? "uses" : "use"} ${language}.`
    : null;
  const repoLine = repos.length
    ? `In the Garage, ${repos.length === 1 ? "one public repository is" : `${repos.length} public repositories are`} ${filter}: ${names(repos)}.`
    : `No public repositories ${filter} are currently listed in Omjee's Garage.`;

  return {
    answer: paragraphs(flagshipLine, repoLine),
    sourceIds: [...sourceIds, ...flagship.slice(0, 2).map((project) => `project:${project.slug}`)],
    cards: [...flagship.map(projectCard), ...cards].slice(0, MAX_CARDS),
    followUps,
    stats: [stat(repos.length, "Repositories matched"), stat(kb.repos.length, "In the Garage")],
    related: relatedFrom([language, category].filter((item): item is string => item !== null)),
    actions,
  };
}

/* --------------------------------------------------------------------- skills */

interface EvidenceProject {
  domain: SkillDomain;
  project: Project;
  evidence: Evidence;
}

/**
 * Evidence entries of a skill domain that point at a project: by case-study link, or by
 * name for archive projects. Projects with a case study come first — they are where a
 * visitor can actually read how the skill was used.
 */
function evidenceProjects(domain: SkillDomain): EvidenceProject[] {
  const linked: EvidenceProject[] = [];
  for (const evidence of domain.evidence) {
    const project = evidence.href?.startsWith("/work/")
      ? findProject(evidence.href.slice("/work/".length))
      : visibleProjects().find((candidate) => candidate.title === evidence.source);
    if (project && !linked.some((item) => item.project === project)) linked.push({ domain, project, evidence });
  }
  return [...linked.filter((item) => item.project.caseStudy), ...linked.filter((item) => !item.project.caseStudy)];
}

const unique = <T,>(items: readonly T[]): T[] => [...new Set(items)];

/** Every sentence the portfolio writes about a project: its summary, then its case study in reading order. */
function projectSentences(project: Project): string[] {
  const study = project.caseStudy;
  const blocks = study ? CASE_SECTIONS.flatMap(({ key }) => sectionLines(study[key] ?? [])) : [];
  return [project.summary, ...blocks].flatMap(splitSentences);
}

/** Longest sentence worth quoting as a one-line illustration. */
const USAGE_WORDS = 40;

/**
 * One sentence on how a technology was used in a project, from the most specific statement
 * the content makes: the evidence note that names it, a sentence of the project's own text,
 * a highlight of the role that built the project, the evidence given for the skill's domain —
 * and only then the bare fact that it is listed in the stack, said alongside what the project
 * is. Nothing is inferred: each branch quotes a field.
 */
function usageLine(project: Project, wanted: readonly string[], cited: EvidenceProject | undefined): { line: string; specific: boolean } {
  const quote = (text: string) => ({ line: `${project.title}: ${ensurePeriod(text)}`, specific: true });
  if (cited && mentions(cited.evidence.note, wanted)) return quote(cited.evidence.note);

  const stated = projectSentences(project).filter((sentence) => mentions(sentence, wanted));
  const sentence = stated.find((candidate) => wordCount(candidate) <= USAGE_WORDS) ?? stated[0];
  if (sentence) return quote(sentence);

  const highlight = experience
    .filter((role) => role.projects?.includes(project.slug))
    .flatMap((role) => role.highlights.map((item) => item.text))
    .find((text) => mentions(text, wanted));
  if (highlight) return quote(highlight);

  if (cited) {
    return { line: `${project.title} is cited as evidence for ${cited.domain.title}: ${ensurePeriod(cited.evidence.note)}`, specific: true };
  }
  return { line: `${project.title} — ${lowerFirst(stripTrailingPeriod(project.tagline))} — lists it in its stack.`, specific: false };
}

/** A summary sentence that follows a line already about its project: "It is a …". */
const contextSentence = (sentence: string): string => (/^(A|An)\s/.test(sentence) ? `It is ${lowerFirst(sentence)}` : sentence);

/** Evidence entries quoted as the content gives them: "source — note; source — note". */
const evidenceList = (domain: SkillDomain): string =>
  domain.evidence.map((evidence) => `${evidence.source} — ${stripTrailingPeriod(evidence.note)}`).join("; ");

/**
 * A skill or keyword ("What does Omjee know about RAG?", or just "FastAPI"): where the
 * portfolio lists it, then the case studies where it can be seen in use, one sentence each.
 * When the content ties the skill to no project, the answer says so and quotes the evidence
 * given for its domain instead of implying a connection.
 */
function composeTechnology(technologies: Entity[]): Composed {
  const lines: string[] = [];
  const sourceIds: string[] = [];
  const showcase: Project[] = [];
  const domainCards: SkillDomain[] = [];
  const related: string[] = [];
  const single = technologies.length === 1;

  for (const technology of technologies.slice(0, 2)) {
    const wanted = technology.aliases[0]?.split(" ") ?? [];
    const domains = skills.filter((domain) => domain.items.some((item) => namesTechnology(item, technology)));
    const inStack = visibleProjects().filter((project) => project.stack.some((item) => namesTechnology(item, technology)));
    const role = experience.find((candidate) => candidate.stack.some((item) => namesTechnology(item, technology)));

    // Projects cited as evidence for the skill's domain count only when they involve the skill
    // itself: its name is in their stack, or the evidence or the project's summary mentions it.
    const cited = domains.flatMap(evidenceProjects);
    const involved = cited.filter(
      ({ project, evidence }) => inStack.includes(project) || mentions(`${evidence.note} ${project.tagline} ${project.summary}`, wanted),
    );
    const projects = unique([...involved.map((item) => item.project), ...inStack]);
    // Case studies first: they are where a visitor can read how the skill was actually used.
    const ordered = [...projects.filter((project) => project.caseStudy), ...projects.filter((project) => !project.caseStudy)];
    const shown = ordered.slice(0, single ? 3 : 1);

    // The full stack list is only worth a sentence when it names projects the lines below do not.
    const listStack = inStack.some((project) => !shown.includes(project));
    lines.push(
      [
        // Phrased around the name so it reads the same for "RAG" and for "Transformers".
        domains.length
          ? `Omjee's portfolio lists ${technology.name} as a capability, under ${joinList(domains.map((domain) => domain.title))}.`
          : `Omjee's portfolio does not list ${technology.name} as a capability of its own; it appears through his project work.`,
        listStack ? `It is in the stack of ${joinList(inStack.map((project) => project.title))}.` : null,
        role ? `It ${listStack ? "also " : ""}features in his work as ${role.role} at ${role.organization}.` : null,
      ]
        .filter(Boolean)
        .join(" "),
    );

    if (shown.length > 0) {
      const usage = shown.map((project) => usageLine(project, wanted, involved.find((item) => item.project === project)));
      // Lines that quote how the skill was used come before those that can only confirm the stack.
      const ranked = [...usage.filter((item) => item.specific), ...usage.filter((item) => !item.specific)].map((item) => item.line);
      // With one project there is room for a second sentence that places the skill in the system.
      const [only] = shown;
      const context =
        single && shown.length === 1
          ? splitSentences(only.summary).find((sentence) => mentions(sentence, wanted) && !ranked[0].includes(sentence))
          : undefined;
      lines.push([...fitToBudget(ranked, 90).kept, context ? contextSentence(context) : null].filter(Boolean).join(" "));
    } else if (domains.length > 0) {
      lines.push(
        `The portfolio does not tie ${technology.name} to one project. ${domains
          .map((domain) => `The evidence it cites for ${domain.title}: ${evidenceList(domain)}.`)
          .join(" ")}`,
      );
    }

    const fallback = shown.length > 0 ? [] : cited.map((item) => item.project);
    sourceIds.push(...domains.map((domain) => `skill:${domain.id}`), ...[...shown, ...fallback].map((project) => `project:${project.slug}`));
    showcase.push(...shown, ...fallback);
    domainCards.push(...domains);
    related.push(...domains.flatMap((domain) => domain.items.filter((item) => !namesTechnology(item, technology))));
  }

  const projects = unique(showcase).slice(0, MAX_CARDS - 1);
  const study = projects.find((project) => project.caseStudy);
  return {
    answer: paragraphs(...lines),
    sourceIds: unique(sourceIds),
    cards: [...projects.map(projectCard), ...unique(domainCards).map(skillCard)].slice(0, MAX_CARDS),
    followUps: [...projects.slice(0, 2).map((project) => `What is ${project.title}?`), "What technologies does he work with?", ...generalFollowUps()],
    related: relatedFrom(related),
    actions: [ACTIONS.capabilities, ...(study ? [projectAction(study)] : [])],
  };
}

function composeSkillDomain(domainId: string): Composed | null {
  const domain = skills.find((candidate) => candidate.id === domainId);
  if (!domain) return null;
  const cited = evidenceProjects(domain);
  const study = cited.find((item) => item.project.caseStudy)?.project;
  return {
    answer: paragraphs(
      `${domain.title}: ${ensurePeriod(domain.summary)} In Omjee's portfolio this capability domain lists ${joinList(domain.items)}.`,
      domain.evidence.length ? `Evidence cited for it: ${evidenceList(domain)}.` : null,
    ),
    sourceIds: [`skill:${domain.id}`, ...cited.map((item) => `project:${item.project.slug}`)],
    cards: [...cited.slice(0, MAX_CARDS - 1).map((item) => projectCard(item.project)), skillCard(domain)],
    followUps: [...cited.slice(0, 2).map((item) => `What is ${item.project.title}?`), "What technologies does he work with?", ...generalFollowUps()],
    stats: [stat(domain.items.length, "Tools and concepts"), stat(domain.evidence.length, "Evidence entries")],
    related: relatedFrom(domain.items),
    actions: [ACTIONS.capabilities, ...(study ? [projectAction(study)] : [])],
  };
}

function composeUnknownTechnology(name: string, question: string): Composed {
  const at = question.toLowerCase().indexOf(name);
  const display = at >= 0 ? question.slice(at, at + name.length) : name;
  return {
    answer: paragraphs(
      `Experience with ${display} isn't currently documented in Omjee's public portfolio.`,
      `The technologies it does document are grouped under ${joinList(skills.map((domain) => domain.title))}.`,
    ),
    sourceIds: [],
    cards: [],
    followUps: ["What technologies does he work with?", ...generalFollowUps()],
    actions: [ACTIONS.capabilities],
  };
}

function composeSkills(): Composed {
  return {
    answer: paragraphs(
      `Omjee's portfolio groups his capabilities into ${plural(skills.length, "domain")}: ${joinList(skills.map((domain) => domain.title))}.`,
      skills.map((domain) => `${domain.title}: ${domain.items.slice(0, 5).join(", ")}.`).join(" "),
    ),
    sourceIds: skills.map((domain) => `skill:${domain.id}`),
    cards: skills.slice(0, MAX_CARDS).map(skillCard),
    followUps: generalFollowUps().filter((question) => !/technologies/.test(question)),
    stats: [stat(skills.length, "Capability domains"), stat(new Set(skills.flatMap((domain) => domain.items)).size, "Tools and concepts")],
    actions: [ACTIONS.capabilities, ACTIONS.work],
  };
}

/* --------------------------------------------------------------------- person */

function composeAbout(): Composed {
  const featured = featuredProjects();
  return {
    answer: paragraphs(
      site.description,
      education.map((item, index) => educationSentence(item, "He", index > 0)).join(" "),
      `In his own words: "${profile.about.lead}"${featured.length ? ` His featured work is ${joinList(featured.map((project) => project.title))}.` : ""}`,
    ),
    sourceIds: ["profile", ...education.map((item) => `education:${item.id}`), "philosophy:principles"],
    cards: featured.slice(0, MAX_CARDS).map(projectCard),
    followUps: generalFollowUps(),
    actions: [ACTIONS.capabilities, ACTIONS.work],
  };
}

function composePhilosophy(): Composed {
  const { principles, layers } = profile;
  return {
    answer: paragraphs(
      `Omjee's working approach rests on ${plural(principles.length, "principle")}: ${joinList(principles.map((principle) => principle.title))}.`,
      `In his own words — ${principles.map((principle) => `${principle.title}: "${principle.detail}"`).join(" ")}`,
      `He works across ${plural(layers.length, "layer")}: ${joinList(layers.map((layer) => layer.label))}.`,
    ),
    sourceIds: ["philosophy:principles", "philosophy:layers", "profile"],
    cards: [],
    followUps: generalFollowUps(),
    actions: [ACTIONS.about, ACTIONS.work],
  };
}

/**
 * "What has Omjee built?" — the whole body of work in one brief: the programmes in the order
 * the site presents them, then everything smaller, with the counts that size it.
 */
function composeProjects(kb: KnowledgeBase): Composed {
  const featured = featuredProjects();
  const { archive, standalone, total } = otherBuilds(kb);
  const smaller = [...archive, ...standalone];
  return {
    answer: paragraphs(
      `Omjee's portfolio is built around ${plural(featured.length, "primary system")}, each documented as a full case study.`,
      // The discipline, not the tagline: the evidence rows under the answer carry the taglines.
      `In the order the site presents them: ${joinList(featured.map((project) => `${project.title} (${project.discipline ?? project.tagline})`))}.`,
      total > 0 && `Behind them are ${plural(total, "smaller build")} across the archive and the Garage, including ${names(smaller, 4)}.`,
    ),
    sourceIds: [...featured.map((project) => `project:${project.slug}`), "garage"],
    cards: featured.slice(0, MAX_CARDS).map(projectCard),
    followUps: [
      ...featured.slice(0, 2).map((project, index) => (index === 0 ? `Explain ${project.title}` : `What is ${project.title}?`)),
      "What other projects has he built?",
    ],
    stats: [stat(featured.length, "Primary systems"), ...(total > 0 ? [stat(total, "Other builds")] : [])],
    actions: [ACTIONS.work, ACTIONS.garage],
  };
}

const roleLine = (role: Experience): string =>
  `${role.role}, ${role.organization}${role.unit ? ` — ${role.unit}` : ""} (${formatRange(role.start, role.end)}). ${role.summary}`;

/** Pull requests a role links to from its highlights — counted from the links, not from a claim. */
const linkedPulls = (roles: readonly Experience[]): number =>
  roles.flatMap((role) => role.highlights.flatMap((highlight) => highlight.links ?? [])).filter((link) => /\/pull\/\d+/.test(link.href)).length;

const roleProjects = (roles: readonly Experience[]): Project[] =>
  roles.flatMap((role) => role.projects ?? []).map(findProject).filter((project): project is Project => project !== undefined);

function composeRole(role: Experience): Composed {
  const built = roleProjects([role]);
  const pulls = linkedPulls([role]);
  const highlights = fitToBudget(
    role.highlights.map((highlight) => highlight.text),
    BUDGET - 40,
  ).kept;
  return {
    answer: paragraphs(roleLine(role), highlights.length ? `Highlights: ${highlights.join(" ")}` : null),
    sourceIds: [`experience:${role.id}`, `achievement:${role.id}`, ...built.map((project) => `project:${project.slug}`)],
    cards: [experienceCard(role), ...built.map(projectCard)].slice(0, MAX_CARDS),
    followUps: [...built.map((project) => `Explain ${project.title}`), "What experience does he have?", "What technologies does he work with?"],
    stats: pulls > 0 ? [stat(pulls, "Pull requests linked")] : undefined,
    related: relatedFrom(role.stack),
    actions: [ACTIONS.experience, ...built.slice(0, 1).map(projectAction)],
  };
}

function composeExperience(roleId: string | null): Composed {
  const focused = experience.find((role) => role.id === roleId);
  if (focused) return composeRole(focused);
  const [built] = roleProjects(experience);
  const pulls = linkedPulls(experience);
  return {
    answer: paragraphs(
      `Omjee's portfolio lists ${plural(experience.length, "role")}.`,
      ...experience.map(roleLine),
    ),
    sourceIds: experience.map((role) => `experience:${role.id}`),
    cards: experience.slice(0, MAX_CARDS).map(experienceCard),
    followUps: [built ? `Explain ${built.title}` : null, "What is his Codeforces rating?", "Where does he study?"].filter(
      (question): question is string => question !== null,
    ),
    stats: [
      stat(experience.length, "Roles"),
      ...(pulls > 0 ? [stat(pulls, "Pull requests linked")] : []),
      ...(education.length > 0 ? [stat(education.length, education.every((item) => item.end === null) ? "Degrees in progress" : "Degrees")] : []),
    ],
    related: relatedFrom(...experience.map((role) => role.stack)),
    actions: [ACTIONS.experience, ...(built ? [projectAction(built)] : [])],
  };
}

const ASKS_GRADES = /\b(c?gpa|grades?|marks|score|cumulative)\b/i;

function composeEducation(question = ""): Composed {
  const degrees = education.map((item, index) => educationSentence(item, index === 0 ? "Omjee" : "He", index > 0)).join(" ");
  const grades = cgpaSentence();
  const leadWithGrades = ASKS_GRADES.test(question);
  return {
    answer: degrees ? (leadWithGrades ? paragraphs(grades, degrees) : paragraphs(degrees, grades)) : NOT_DOCUMENTED,
    sourceIds: leadWithGrades
      ? ["resume:education", ...education.map((item) => `education:${item.id}`)]
      : [...education.map((item) => `education:${item.id}`), "resume:education"],
    cards: [],
    followUps: ["What skills does he list on his résumé?", "What experience does he have?", `What is ${profile.firstName} researching?`],
    stats: resume.education.map((item) => ({ value: item.cgpa.replace(/\/10$/, ""), label: `CGPA · ${item.short}` })),
    actions: [ACTIONS.resume, ACTIONS.experience],
  };
}

/** One part of the résumé, as the PDF states it. */
function composeResumeSection(section: ResumeSection): Composed {
  const resumeAction = ACTIONS.resume;
  switch (section) {
    case "education":
      return composeEducation("cgpa");
    case "summary":
      return {
        answer: paragraphs(`The summary at the top of Omjee's résumé reads: "${resume.summary}"`),
        sourceIds: ["resume:summary"],
        cards: [],
        followUps: ["What skills does he list on his résumé?", "What is his CGPA?", "What experience does he have?"],
        actions: [resumeAction, ACTIONS.about],
      };
    case "skills": {
      const count = new Set(resume.skills.flatMap((group) => group.items)).size;
      return {
        answer: paragraphs(
          `His résumé lists technical skills in ${plural(resume.skills.length, "group")}.`,
          resume.skills.map((group) => `${group.group}: ${group.items.join(", ")}.`).join(" "),
        ),
        sourceIds: ["resume:skills", ...skills.slice(0, 2).map((domain) => `skill:${domain.id}`)],
        cards: [],
        followUps: ["What technologies does he work with?", "What is his CGPA?", "What projects are on his résumé?"],
        stats: [stat(resume.skills.length, "Skill groups"), stat(count, "Skills listed")],
        actions: [resumeAction, ACTIONS.capabilities],
      };
    }
    case "experience":
      return {
        answer: paragraphs(
          `His résumé lists ${plural(resume.experience.length, "role")}.`,
          ...resume.experience.map((role) => `${role.role}, ${role.organization} (${role.period}). ${role.bullets[0]}`),
        ),
        sourceIds: resume.experience.map((role) => `resume:experience:${normalize(role.short).replace(/ /g, "-")}`),
        cards: experience.slice(0, MAX_CARDS).map(experienceCard),
        followUps: ["What experience does he have?", "What is his CGPA?", "What skills does he list on his résumé?"],
        stats: [stat(resume.experience.length, "Roles on the résumé")],
        actions: [resumeAction, ACTIONS.experience],
      };
    case "projects": {
      const linked = resume.projects
        .map((entry) => (entry.slug ? findProject(entry.slug) : undefined))
        .filter((project): project is Project => project !== undefined);
      return {
        answer: paragraphs(
          `His résumé describes ${plural(resume.projects.length, "project")}: ${joinList(resume.projects.map((entry) => entry.short))}.`,
          fitToBudget(
            resume.projects.map((entry) => `${entry.short}: ${stripTrailingPeriod(entry.bullets[0])}.`),
            BUDGET - 25,
          ).kept.join(" "),
        ),
        sourceIds: resume.projects.map((entry) => `resume:project:${entry.slug ?? normalize(entry.short).replace(/ /g, "-")}`),
        cards: linked.slice(0, MAX_CARDS).map(projectCard),
        followUps: linked.slice(0, 2).map((project) => `Explain ${project.title}`).concat("What skills does he list on his résumé?"),
        stats: [stat(resume.projects.length, "Projects on the résumé")],
        actions: [resumeAction, ACTIONS.work],
      };
    }
    case "achievements":
      return {
        answer: paragraphs(`His résumé lists ${plural(resume.achievements.length, "achievement")}.`, resume.achievements.join(" ")),
        sourceIds: ["resume:achievements", "achievement:codeforces"],
        cards: [],
        followUps: ["Tell me about his Codeforces rating", "What experience does he have?", "What is his CGPA?"],
        actions: [resumeAction, ACTIONS.experience],
      };
  }
}

function availabilitySentence(): string {
  const { open, label, note } = profile.availability;
  if (open && /^open to\b/i.test(note)) return `Omjee is ${lowerFirst(note)}`;
  return `Omjee's current availability: ${label}. ${note}`;
}

const profilesSentence = (): string => joinList(profile.socials.map((social) => `${social.label} (${social.handle})`));

function composeContact(): Composed {
  return {
    answer: paragraphs(`Omjee can be reached by email at ${profile.email}.`, `He is also on ${profilesSentence()}.`),
    sourceIds: ["contact", "resume"],
    cards: [],
    followUps: ["What roles is he looking for?", `What kind of engineer is ${profile.firstName}?`, ...generalFollowUps()],
    actions: [ACTIONS.contact, ACTIONS.resume],
  };
}

/** A contact detail the portfolio does not publish (a phone number): say so, then give what it does. */
function composeUnlistedContact(): Composed {
  return {
    answer: paragraphs(
      NOT_DOCUMENTED,
      `What the contact section does list: his email, ${profile.email}, and his profiles on ${profilesSentence()}.`,
    ),
    sourceIds: ["contact"],
    cards: [],
    followUps: [`How can I contact ${profile.firstName}?`, "What roles is he looking for?", ...generalFollowUps()],
    actions: [ACTIONS.contact, ACTIONS.resume],
  };
}

function composeResume(): Composed {
  return {
    answer: `Omjee's résumé is available as a PDF (${profile.resume.fileName}) at ${profile.resume.href} on this site.`,
    sourceIds: ["resume", "contact"],
    cards: [],
    followUps: ["What experience does he have?", "What roles is he looking for?", "What technologies does he work with?"],
    actions: [ACTIONS.resume, ACTIONS.contact],
  };
}

function composeAvailability(): Composed {
  return {
    answer: paragraphs(availabilitySentence(), `He can be reached by email at ${profile.email}.`),
    sourceIds: ["availability", "contact"],
    cards: [],
    followUps: [`How can I contact ${profile.firstName}?`, "What experience does he have?", ...generalFollowUps()],
    actions: [ACTIONS.contact, ACTIONS.resume],
  };
}

function composeResearch(): Composed {
  const describe = (item: { title: string; note?: string }) =>
    item.note ? `${item.title} — ${stripTrailingPeriod(item.note)}` : item.title;
  const researching = now.groups.filter((group) => /research/i.test(group.label));
  const others = now.groups.filter((group) => !/research/i.test(group.label));
  const linked = now.groups
    .flatMap((group) => group.items)
    .map((item) => (item.href?.startsWith("/work/") ? findProject(item.href.slice("/work/".length)) : undefined))
    .filter((project): project is Project => project !== undefined);
  const subject = findProject(research.project);

  return {
    answer: paragraphs(
      researching.length
        ? `Omjee's current research: ${researching.flatMap((group) => group.items).map(describe).join("; ")}.`
        : research.intro,
      others.map((group) => `${group.label}: ${joinList(group.items.map((item) => item.title))}.`).join(" "),
      research.disclaimer,
    ),
    sourceIds: ["now", "research", ...(subject ? [`project:${subject.slug}`] : [])],
    cards: [...new Set([...(subject ? [subject] : []), ...linked])].slice(0, MAX_CARDS).map(projectCard),
    followUps: subject ? projectFollowUps(subject, "next") : generalFollowUps(),
    related: subject ? relatedFrom(subject.stack) : undefined,
    actions: [ACTIONS.research, ...(subject ? [projectAction(subject)] : [])],
  };
}

function composeAchievements(kb: KnowledgeBase): Composed {
  const { codeforces } = kb;
  const social = (id: string) => profile.socials.find((candidate) => candidate.id === id);
  const leetcode = social("leetcode");
  const profileLink = social("codeforces");
  const linked = achievements.find((achievement) => achievement.href && achievement.linkLabel);
  return {
    answer: paragraphs(
      codeforcesSentence(codeforces),
      `His résumé lists: "${resume.achievements[0].replace(/,\s*codeforces\.com\S*$/i, ".")}"`,
      ...achievements.map((achievement) => `${achievement.title}: ${achievement.detail}`),
      leetcode ? `He also keeps a LeetCode profile (${leetcode.handle}).` : null,
    ),
    sourceIds: ["achievement:codeforces", "resume:achievements", ...achievements.map((achievement) => `achievement:${achievement.id}`)],
    cards: [],
    followUps: ["What experience does he have?", "What technologies does he work with?", ...generalFollowUps()],
    // Fetched from Codeforces with the rest of the page data (or its committed snapshot).
    stats: [
      { value: String(codeforces.rating), label: "Codeforces rating" },
      { value: String(codeforces.maxRating), label: "Peak rating" },
      stat(codeforces.history.length, "Rated contests"),
    ],
    actions: [
      ACTIONS.experience,
      ...(profileLink ? [{ label: "Open Codeforces profile", href: profileLink.href }] : []),
      ...(linked?.href && linked.linkLabel ? [{ label: linked.linkLabel, href: linked.href }] : []),
    ],
  };
}

/** Replies about the assistant itself still point somewhere, so no answer is a dead end. */
const assistantNote = (answer: string): Composed => ({
  answer,
  sourceIds: [],
  cards: [],
  followUps: getSuggestions(),
  actions: [ACTIONS.work, ACTIONS.capabilities, ACTIONS.experience],
});

/* ------------------------------------------------------------------- dispatch */

/** Compose an answer for a recognised intent, or null when the question needs retrieval. */
export function composeDirect(intent: Intent, kb: KnowledgeBase, question: string): Composed | null {
  switch (intent.kind) {
    case "none":
      return null;
    case "offtopic":
      return assistantNote(REDIRECT);
    case "greeting":
      return assistantNote(
        "Hello — this is an AI guide to Omjee R Giri's portfolio. Ask about his projects, research, skills, experience or how to get in touch.",
      );
    case "thanks":
      return assistantNote("You're welcome. There is more to explore in Omjee's projects, research and experience whenever you like.");
    case "identity":
      return assistantNote(
        "This is an AI guide to Omjee R Giri's portfolio — not Omjee himself. It answers only from the portfolio's own content: his projects, research, skills, experience and contact details.",
      );
    case "about":
      return composeAbout();
    case "philosophy":
      return composePhilosophy();
    case "projects":
      return composeProjects(kb);
    case "skills":
      return composeSkills();
    case "experience":
      return composeExperience(intent.roleId);
    case "education":
      return composeEducation(question);
    case "resume-section":
      return composeResumeSection(intent.section);
    case "contact":
      return composeContact();
    case "contact-unlisted":
      return composeUnlistedContact();
    case "resume":
      return composeResume();
    case "availability":
      return composeAvailability();
    case "research":
      return composeResearch();
    case "achievements":
      return composeAchievements(kb);
    case "garage":
      return composeGarage(intent, kb);
    case "tech":
      return composeTechnology(intent.technologies);
    case "tech-unknown":
      return composeUnknownTechnology(intent.name, question);
    case "skill-domain":
      return composeSkillDomain(intent.domainId);
    case "project":
      return composeProject(intent, kb);
    case "repo":
      return composeRepo(intent.name, kb);
  }
}
