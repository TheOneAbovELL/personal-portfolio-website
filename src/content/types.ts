/**
 * Content model for the portfolio.
 *
 * Everything the site says about Omjee lives in `src/content/*.ts` and is shaped by these
 * types. Components read this data; they never hard-code facts. Optional fields are truly
 * optional — a section with no data is not rendered.
 */

export type ProjectStatus =
  | "active"
  | "in-development"
  | "research"
  | "prototype"
  | "experimental"
  | "completed"
  | "archived";

export type ProjectCategory = "research" | "engineering" | "experiment";

/** Which bespoke figure (if any) illustrates a project. */
export type ProjectFigure = "pipeline" | "risk" | "montage";

/**
 * A featured programme's identity within the master palette — what the work is about, not a
 * colour. The colours each one maps to live with the components (components/work/theme.ts).
 *   evidence  retrieval, knowledge, citation
 *   signal    neural signals, topology, frequency
 *   market    market data, quantitative signals
 */
export type ProgrammeTheme = "evidence" | "signal" | "market";

/**
 * The scannable brief shown with a programme on the homepage. Each field is one or two
 * sentences distilled from the project's `caseStudy` — a restatement, never a new claim.
 */
export interface ProgrammeBrief {
  problem: string;
  system: string;
}

export interface LinkRef {
  label: string;
  href: string;
}

export interface Fact {
  label: string;
  value: string;
}

export interface TitledNote {
  title: string;
  detail: string;
}

export interface CaseStudy {
  /** What problem exists and why it matters. */
  problem: string[];
  /** How the system addresses it, in plain language. */
  approach: string[];
  /** The parts of the system and what each is responsible for. */
  architecture?: TitledNote[];
  /** Decisions with their rationale — the "why", not the "what". */
  decisions?: TitledNote[];
  /** Testing, failure handling, operational concerns. */
  reliability?: string[];
  /** What exists and works today. Verified statements only. */
  outcome?: string[];
  /** Known gaps, stated plainly. */
  limitations?: string[];
  learnings?: string[];
  next?: string[];
}

export interface Project {
  slug: string;
  title: string;
  /** Longer formal name, shown on the case study when it differs from `title`. */
  fullTitle?: string;
  /** The engineering discipline the project belongs to, e.g. "AI / Retrieval systems". */
  discipline?: string;
  /** One line naming the kind of system, set under the programme title. Restates the tagline. */
  designation?: string;
  /** Featured programmes only: the identity that tints its numeral, rules, figure and transition. */
  theme?: ProgrammeTheme;
  /** Featured programmes only: the homepage brief. */
  brief?: ProgrammeBrief;
  /** One-line positioning. */
  tagline: string;
  /** Two or three sentences for the homepage and archive. */
  summary: string;
  category: ProjectCategory;
  status: ProjectStatus;
  /** Honest qualifier shown next to the status, e.g. "Not clinically validated". */
  statusNote?: string;
  /** Featured projects appear on the homepage and get a full case study. */
  featured: boolean;
  /** Set to false to hide a project everywhere without deleting it. */
  visible: boolean;
  /** Sort key within its tier; lower comes first. */
  order: number;
  year: string;
  role?: string;
  context?: string;
  /** Most important technologies first; long lists are truncated by the UI. */
  stack: string[];
  figure?: ProjectFigure;
  links: {
    repo?: string;
    demo?: string;
    paper?: string;
  };
  /** Short, countable, checkable facts. Never estimates. */
  facts?: Fact[];
  caseStudy?: CaseStudy;
}

export type ExperienceKind =
  | "research"
  | "open-source"
  | "internship"
  | "work"
  | "freelance"
  | "hackathon";

export interface Experience {
  id: string;
  organization: string;
  /** Department, team or project within the organization. */
  unit?: string;
  role: string;
  kind: ExperienceKind;
  /** ISO year-month, e.g. "2026-01". */
  start: string;
  /** ISO year-month, or null while ongoing. */
  end: string | null;
  summary: string;
  highlights: { text: string; links?: LinkRef[] }[];
  stack: string[];
  /** Slugs of related projects. */
  projects?: string[];
  links?: LinkRef[];
}

export interface Education {
  id: string;
  institution: string;
  degree: string;
  field: string;
  start: string;
  end: string | null;
}

export interface Evidence {
  /** Where the skill was used — a project or activity name. */
  source: string;
  /** What was actually built or done with it. */
  note: string;
  /** Internal path or external URL. */
  href?: string;
}

export interface SkillDomain {
  id: string;
  title: string;
  summary: string;
  items: string[];
  evidence: Evidence[];
}

export interface Achievement {
  id: string;
  title: string;
  detail: string;
  href?: string;
  /** Text for the link, e.g. "View merged pull requests". */
  linkLabel?: string;
}

export interface NowGroup {
  label: string;
  items: { title: string; note?: string; href?: string }[];
}
