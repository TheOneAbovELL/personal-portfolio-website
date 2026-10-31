import { HeaderBar } from "@/components/nav/HeaderBar";
import type { NavData, NavProgramme } from "@/components/nav/types";
import { NEUTRAL_PALETTE, PROGRAMME_PALETTE, programmeNumber } from "@/components/work/theme";
import { featuredProjects, profile, showcaseProjects, site, statusLabel } from "@/content";
import type { Project } from "@/content";

/**
 * The site header and its navigator. This server half reads the content — every sector, page
 * and programme, through the same selectors the pages use, so a new project appears here
 * without touching navigation — and hands the client half only the labels it shows.
 */
function navData(): NavData {
  const featured = featuredProjects();
  const showcase = showcaseProjects();

  const programme = (project: Project, index: number, group: NavProgramme["group"]): NavProgramme => {
    const palette = (project.theme && PROGRAMME_PALETTE[project.theme]) || NEUTRAL_PALETTE;
    return {
      number: programmeNumber(index),
      slug: project.slug,
      title: project.title,
      tagline: project.tagline,
      discipline: project.discipline ?? null,
      status: statusLabel[project.status],
      href: group === "home" ? `/#work-${project.slug}` : `/projects#work-${project.slug}`,
      primary: palette.primary,
      secondary: palette.secondary,
      group,
    };
  };

  return {
    name: profile.name,
    email: profile.email,
    resumeHref: profile.resume.href,
    // Numbered by position in the lap, so a sector left out of the navigator keeps the count honest.
    sectors: site.sections.flatMap((section, index) =>
      section.nav
        ? [
            {
              id: section.id,
              number: String(index + 1).padStart(2, "0"),
              label: section.label,
              note: section.note,
              href: `/#${section.id}`,
              pill: section.pill,
            },
          ]
        : [],
    ),
    pages: site.routes.map(({ href, label, note }) => ({ href, label, note })),
    headerPages: site.headerPages.map(({ href, label }) => ({ href, label })),
    programmes: [
      ...featured.map((project, index) => programme(project, index, "home")),
      ...showcase.map((project, index) => programme(project, featured.length + index, "projects")),
    ],
    socials: profile.socials.map(({ id, label, handle, href }) => ({ id, label, handle, href })),
  };
}

export function Header() {
  return <HeaderBar data={navData()} />;
}
