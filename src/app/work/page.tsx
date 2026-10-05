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

function Group({ title, projects }: { title: string; projects: Project[] }) {
  if (projects.length === 0) return null;
  return (
    <section aria-label={title} className="mt-[clamp(3rem,6vw,5rem)]">
      <h2 className="label flex items-center justify-between border-b border-rule-strong pb-3 text-bone">
        {title}
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

  return (
    <div className="section" data-tone="yellow">
    <div className="shell pb-[clamp(4rem,8vw,7rem)] pt-[calc(var(--header-h)+clamp(3rem,7vw,6rem))]">
      <p className="label text-steel">
        <span className="text-signal">Index</span>
        <span aria-hidden="true" className="mx-2 text-metal-3">
          /
        </span>
        All work
      </p>
      <h1 className="display enter-mask mt-5 text-[clamp(2.75rem,8vw,7rem)] uppercase">Work</h1>
      <p className="prose-body enter mt-6 max-w-[38rem] text-steel" style={{ "--enter-index": 1 } as React.CSSProperties}>
        Everything here is described the way it actually is — active, prototype or research — with links to the code
        wherever it is public.
      </p>

      <Group title="Featured" projects={featured} />
      {CATEGORY_ORDER.map((category) => (
        <Group
          key={category}
          title={categoryLabel[category]}
          projects={archive.filter((project) => project.category === category)}
        />
      ))}
    </div>
    </div>
  );
}
