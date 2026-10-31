import type { Metadata } from "next";
import { ProjectRow } from "@/components/work/ProjectRow";
import { archiveProjects, categoryLabel, featuredProjects, type Project, type ProjectCategory } from "@/content";

export const metadata: Metadata = {
  title: "Work",
  description:
    "Every project by Omjee R Giri: retrieval systems, quantitative engines, ML research and smaller experiments — each with its real status.",
  alternates: { canonical: "/work" },
};

const CATEGORY_ORDER: ProjectCategory[] = ["research", "engineering", "experiment"];

/** A group of the index: a ruled heading with its count, then the rows. Arrives as a sector does. */
function Group({ index, title, projects }: { index: number; title: string; projects: Project[] }) {
  if (projects.length === 0) return null;
  return (
    <section aria-label={title} className="mt-[clamp(3rem,6vw,5rem)]">
      <div className="scale-ticks" aria-hidden="true" data-reveal="trace" />
      <h2 className="label mt-4 flex items-baseline justify-between text-steel" data-reveal="snap">
        <span>
          <span className="text-champagne" data-reveal="tick">
            {String(index).padStart(2, "0")}
          </span>
          <span aria-hidden="true" className="mx-2 text-metal-3">
            /
          </span>
          {title}
        </span>
        <span className="text-faint">{String(projects.length).padStart(2, "0")}</span>
      </h2>
      <ul>
        {projects.map((project) => (
          <ProjectRow key={project.slug} project={project} />
        ))}
      </ul>
    </section>
  );
}

export default function WorkPage() {
  const featured = featuredProjects();
  const archive = archiveProjects();
  const groups = [
    { title: "Featured", projects: featured },
    ...CATEGORY_ORDER.map((category) => ({
      title: categoryLabel[category],
      projects: archive.filter((project) => project.category === category),
    })),
  ].filter((group) => group.projects.length > 0);
  const total = groups.reduce((sum, group) => sum + group.projects.length, 0);

  return (
    <div className="section" data-tone="yellow">
      {/* The page header is a time-based entrance (it is the first viewport, under the route
          veil); everything below it reveals on scroll like a homepage sector. */}
      <div
        className="shell pb-[clamp(4rem,8vw,7rem)] pt-[calc(var(--header-h)+clamp(3rem,7vw,6rem))]"
        style={{ "--enter-base": "200ms" } as React.CSSProperties}
      >
        <div className="sector-line scale-ticks enter-fade" aria-hidden="true">
          <i />
        </div>
        <div className="enter mt-4 flex items-baseline justify-between gap-6">
          <p className="label text-steel">
            <span className="text-champagne">Index</span>
            <span aria-hidden="true" className="mx-2 text-metal-3">
              /
            </span>
            All work
          </p>
          <p className="label text-faint">
            {String(total).padStart(2, "0")} projects · {groups.length} groups
          </p>
        </div>
        <h1
          className="display enter-mask mt-[clamp(1.5rem,3vw,2.5rem)] text-[clamp(2.75rem,8vw,7rem)]"
          style={{ "--enter-index": 1 } as React.CSSProperties}
        >
          Work
        </h1>
        <p className="prose-body enter measure mt-6 text-steel" style={{ "--enter-index": 2 } as React.CSSProperties}>
          Everything here is described the way it actually is — active, prototype or research — with links to the code
          wherever it is public.
        </p>

        {groups.map((group, index) => (
          <Group key={group.title} index={index + 1} title={group.title} projects={group.projects} />
        ))}
      </div>
    </div>
  );
}
