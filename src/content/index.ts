import { projects } from "./projects";
import type {
  FeaturedProject,
  ProgrammeTheme,
  Project,
  ProjectCategory,
  ProjectStatus,
  ShowcaseProject,
  ShowcaseTheme,
} from "./types";

export { achievements, codeforcesSnapshot } from "./achievements";
export { education, experience } from "./experience";
export { now } from "./now";
export { profile } from "./profile";
export { projects } from "./projects";
export { research } from "./research";
export { site } from "./site";
export { skills } from "./skills";
export type * from "./types";

const byOrder = (a: Project, b: Project) => a.order - b.order;

export const visibleProjects = (): Project[] => projects.filter((p) => p.visible).sort(byOrder);

const HOMEPAGE_THEMES: readonly (ProgrammeTheme | undefined)[] = ["evidence", "signal", "market", undefined];

/** The homepage programmes. A featured project carries a homepage identity (or none). */
export const featuredProjects = (): FeaturedProject[] =>
  visibleProjects().filter((p): p is FeaturedProject => p.featured && HOMEPAGE_THEMES.includes(p.theme as ProgrammeTheme));

const SHOWCASE_THEMES: readonly (ShowcaseTheme | undefined)[] = [
  "trace",
  "bench",
  "context",
  "circuit",
  "attention",
  "chess",
  "telemetry",
  undefined,
];

/** The /projects programmes, which continue the homepage sequence. */
export const showcaseProjects = (): ShowcaseProject[] =>
  visibleProjects().filter(
    (p): p is ShowcaseProject => !!p.showcase && !p.featured && SHOWCASE_THEMES.includes(p.theme as ShowcaseTheme),
  );

export const archiveProjects = (): Project[] => visibleProjects().filter((p) => !p.featured);

export const caseStudyProjects = (): Project[] => visibleProjects().filter((p) => p.caseStudy);

export const getProject = (slug: string): Project | undefined =>
  visibleProjects().find((p) => p.slug === slug);

/** Where a project links to: its case study if it has one, otherwise its row in the archive. */
export const projectHref = (project: Project): string =>
  project.caseStudy ? `/work/${project.slug}` : `/work#${project.slug}`;

export const statusLabel: Record<ProjectStatus, string> = {
  active: "Active",
  "in-development": "In development",
  research: "Research prototype",
  prototype: "Prototype",
  experimental: "Experimental",
  completed: "Completed",
  archived: "Archived",
};

export const categoryLabel: Record<ProjectCategory, string> = {
  research: "Research",
  engineering: "Engineering",
  experiment: "Experiments",
};

const MONTHS = ["Jan", "Feb", "Mar", "Apr", "May", "Jun", "Jul", "Aug", "Sep", "Oct", "Nov", "Dec"];

/** "2026-01" → "Jan 2026". */
export function formatMonth(iso: string): string {
  const [year, month] = iso.split("-");
  const name = MONTHS[Number(month) - 1];
  return name ? `${name} ${year}` : year;
}

export function formatRange(start: string, end: string | null): string {
  return `${formatMonth(start)} — ${end ? formatMonth(end) : "Present"}`;
}
