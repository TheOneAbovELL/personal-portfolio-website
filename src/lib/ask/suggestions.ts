/**
 * Starter questions and follow-ups, generated from the content so they never go stale.
 * Pure and synchronous: safe to call from a Server Component or a client component.
 */

import { experience, featuredProjects, profile, research, skills } from "@/content";
import type { CaseStudy, Project, SkillDomain } from "@/content";

import { mentions, terms } from "./text";

export type ProjectAspect = "overview" | "stack" | "links" | "metrics" | "status" | keyof CaseStudy;

export interface SuggestionGroup {
  id: string;
  label: string;
  questions: string[];
}

const compact = (questions: (string | null | false | undefined)[]): string[] =>
  questions.filter((question): question is string => Boolean(question));

/** True when a case-study block exists and has content. */
const has = (block: readonly unknown[] | undefined): boolean => Boolean(block?.length);

/** Six to eight questions the assistant can always answer without a model. */
export function getSuggestions(): string[] {
  const [first, second] = featuredProjects();
  return compact([
    `What kind of engineer is ${profile.firstName}?`,
    first && `Explain ${first.title}`,
    second && `What is ${second.title}?`,
    `What is ${profile.firstName} researching?`,
    "What technologies does he work with?",
    "What else has Omjee built?",
    profile.availability.open && "What roles is he looking for?",
    `How can I contact ${profile.firstName}?`,
  ]);
}

/**
 * The skill a domain's lead evidence demonstrates: the first listed item that evidence names
 * ("RAG" for a note about retrieval-augmented generation). Asking about it leads somewhere.
 */
function demonstratedSkill(domain: SkillDomain): string | null {
  const lead = domain.evidence[0];
  return (lead && domain.items.find((item) => mentions(lead.note, terms(item)))) ?? null;
}

/**
 * The same starting points, grouped by what a visitor might want to explore. Every question
 * is built from the content and phrased so an intent rule answers it directly — no model call.
 */
export function getSuggestionGroups(): SuggestionGroup[] {
  const featured = featuredProjects();
  const [lead] = featured;
  const study = featured.find((project) => project.slug === research.project);
  const tested = [...featured].reverse().find((project) => has(project.caseStudy?.reliability));
  const demonstrated = skills.map(demonstratedSkill).filter((skill): skill is string => skill !== null);
  const lastDomain = skills[skills.length - 1];

  const groups: SuggestionGroup[] = [
    {
      id: "projects",
      label: "Projects",
      questions: compact([
        `What has ${profile.firstName} built?`,
        ...featured.map((project) => `What is ${project.title}?`),
        "What else has Omjee built?",
      ]),
    },
    {
      id: "skills",
      label: "Skills",
      questions: compact([
        "What technologies does he work with?",
        ...demonstrated.slice(0, 2).map((skill) => `What does ${profile.firstName} know about ${skill}?`),
        lastDomain && `What are his ${lastDomain.title.toLowerCase()} skills?`,
      ]),
    },
    {
      id: "research",
      label: "Research",
      questions: compact([
        `What is ${profile.firstName} researching?`,
        study && has(study.caseStudy?.architecture) && `How is ${study.title} architected?`,
        study && has(study.caseStudy?.limitations) && `What are the limitations of ${study.title}?`,
        study && has(study.caseStudy?.next) && `What is next for ${study.title}?`,
      ]),
    },
    {
      id: "engineering",
      label: "Engineering",
      questions: compact([
        "What is his engineering philosophy?",
        lead && has(lead.caseStudy?.decisions) && `What design decisions shaped ${lead.title}?`,
        tested && `How is ${tested.title} tested and kept reliable?`,
        lead && has(lead.caseStudy?.learnings) && `What did ${profile.firstName} learn building ${lead.title}?`,
      ]),
    },
    {
      id: "experience",
      label: "Experience",
      questions: compact([
        "What experience does he have?",
        experience.some((role) => role.kind === "open-source") && "What has he contributed to open source?",
        profile.availability.open && "What roles is he looking for?",
        `How can I contact ${profile.firstName}?`,
      ]),
    },
  ];
  return groups.filter((group) => group.questions.length > 0);
}

/** Follow-ups after an answer about one project, skipping the aspect just covered. */
export function projectFollowUps(project: Project, covered: ProjectAspect): string[] {
  const study = project.caseStudy;
  const candidates: [ProjectAspect, string | false][] = [
    ["overview", `What is ${project.title}?`],
    ["architecture", has(study?.architecture) && `How is ${project.title} architected?`],
    ["stack", `What technologies does ${project.title} use?`],
    ["decisions", has(study?.decisions) && `What design decisions shaped ${project.title}?`],
    ["limitations", has(study?.limitations) && `What are the limitations of ${project.title}?`],
    ["next", has(study?.next) && `What is next for ${project.title}?`],
    ["learnings", has(study?.learnings) && `What did ${profile.firstName} learn building ${project.title}?`],
  ];
  return candidates
    .filter(([aspect, question]) => aspect !== covered && question !== false)
    .map(([, question]) => question as string)
    .slice(0, 3);
}

/** Follow-ups that open up the rest of the portfolio. */
export function generalFollowUps(): string[] {
  const [first, second] = featuredProjects();
  return compact([
    first && `Explain ${first.title}`,
    second && `What is ${second.title}?`,
    "What technologies does he work with?",
    `What is ${profile.firstName} researching?`,
    "What else has Omjee built?",
  ]);
}
