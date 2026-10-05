import Link from "next/link";
import { Icon } from "@/components/ui/Icon";
import { StatusBadge, TagList } from "@/components/ui/Tag";
import type { Project } from "@/content";

/** A compact archive entry. Projects with a case study link to it; others link out. */
export function ProjectRow({ project }: { project: Project }) {
  const hasCaseStudy = Boolean(project.caseStudy);

  return (
    <li
      id={project.slug}
      className="grid scroll-mt-28 gap-x-10 gap-y-4 border-b border-rule py-8 lg:grid-cols-12"
      data-reveal=""
    >
      <div className="flex items-baseline justify-between gap-4 lg:col-span-2 lg:block">
        <p className="label text-faint">{project.year}</p>
        <div className="lg:mt-3">
          <StatusBadge status={project.status} />
        </div>
      </div>

      <div className="lg:col-span-6">
        <h3 className="display text-[1.625rem]">
          {hasCaseStudy ? (
            <Link href={`/work/${project.slug}`} className="transition-colors duration-[var(--dur-fast)] hover:text-signal">
              {project.title}
            </Link>
          ) : (
            project.title
          )}
        </h3>
        <p className="mt-2 text-[1.0625rem] text-bone">{project.tagline}</p>
        <p className="mt-3 text-[0.9375rem] leading-relaxed text-steel">{project.summary}</p>
        {project.statusNote && <p className="mt-3 text-[0.875rem] text-faint">{project.statusNote}</p>}
      </div>

      <div className="flex flex-col gap-5 lg:col-span-4">
        <TagList items={project.stack} limit={7} label={`${project.title} technologies`} />
        <ul className="flex flex-wrap gap-x-6 gap-y-1">
          {hasCaseStudy && (
            <li>
              <Link
                href={`/work/${project.slug}`}
                className="label inline-flex min-h-11 items-center gap-2 text-bone transition-colors duration-[var(--dur-fast)] hover:text-signal"
                aria-label={`Read the ${project.title} case study`}
              >
                Case study
                <Icon name="arrow-right" size={13} />
              </Link>
            </li>
          )}
          {project.links.repo && (
            <li>
              <a
                href={project.links.repo}
                target="_blank"
                rel="noopener noreferrer"
                className="label inline-flex min-h-11 items-center gap-2 text-steel transition-colors duration-[var(--dur-fast)] hover:text-signal"
                aria-label={`${project.title} repository on GitHub`}
              >
                Repository
                <Icon name="arrow-up-right" size={13} />
              </a>
            </li>
          )}
          {project.links.demo && (
            <li>
              <a
                href={project.links.demo}
                target="_blank"
                rel="noopener noreferrer"
                className="label inline-flex min-h-11 items-center gap-2 text-steel transition-colors duration-[var(--dur-fast)] hover:text-signal"
                aria-label={`${project.title} live demo`}
              >
                Live
                <Icon name="arrow-up-right" size={13} />
              </a>
            </li>
          )}
        </ul>
      </div>
    </li>
  );
}
