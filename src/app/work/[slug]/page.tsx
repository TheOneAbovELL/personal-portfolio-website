import type { Metadata } from "next";
import Link from "next/link";
import { notFound } from "next/navigation";
import { ButtonLink } from "@/components/ui/Button";
import { Icon } from "@/components/ui/Icon";
import { StatusBadge, TagList } from "@/components/ui/Tag";
import { ProjectFigure } from "@/components/work/ProjectFigure";
import { programmeScope } from "@/components/work/theme";
import { caseStudyProjects, getProject, type TitledNote } from "@/content";

export const dynamicParams = false;

export function generateStaticParams() {
  return caseStudyProjects().map((project) => ({ slug: project.slug }));
}

export async function generateMetadata({ params }: { params: Promise<{ slug: string }> }): Promise<Metadata> {
  const { slug } = await params;
  const project = getProject(slug);
  if (!project) return {};
  return {
    title: `${project.title} — ${project.tagline}`,
    description: project.summary,
    alternates: { canonical: `/work/${project.slug}` },
    openGraph: { title: project.title, description: project.summary, url: `/work/${project.slug}`, type: "article" },
  };
}

/** One titled block of the case study. Renders nothing when it has no content. */
function Block({ index, title, children }: { index: number; title: string; children: React.ReactNode }) {
  return (
    <section className="relative grid gap-x-10 gap-y-5 py-[clamp(2.5rem,5vw,4rem)] lg:grid-cols-12">
      <span aria-hidden="true" className="absolute inset-x-0 top-0 h-px bg-rule-strong" data-reveal="trace" />
      <h2 className="label text-steel lg:col-span-3" data-reveal="snap">
        <span className="text-champagne" data-reveal="tick">
          {String(index).padStart(2, "0")}
        </span>
        <span aria-hidden="true" className="mx-2 text-metal-3">
          /
        </span>
        {title}
      </h2>
      <div className="lg:col-span-8" data-reveal="rise" style={{ "--reveal-index": 1 } as React.CSSProperties}>
        {children}
      </div>
    </section>
  );
}

const Paragraphs = ({ items }: { items: string[] }) => (
  <div className="space-y-5">
    {items.map((text, i) => (
      <p key={i} className={`prose-body measure ${i === 0 ? "text-bone" : "text-steel"}`}>
        {text}
      </p>
    ))}
  </div>
);

const Bullets = ({ items }: { items: string[] }) => (
  <ul className="space-y-4">
    {items.map((text, i) => (
      <li key={i} className="prose-body measure grid grid-cols-[1.25rem_1fr] text-bone/90">
        <span aria-hidden="true" className="mt-[0.8em] h-px w-2.5 bg-signal" />
        <span>{text}</span>
      </li>
    ))}
  </ul>
);

const Notes = ({ items, numbered = false }: { items: TitledNote[]; numbered?: boolean }) => (
  <dl>
    {items.map((item, i) => (
      <div key={item.title} className="grid gap-x-8 gap-y-2 border-b border-rule py-5 first:pt-0 sm:grid-cols-[13rem_1fr]">
        <dt className="text-[1.0625rem] font-medium text-bone">
          {numbered && <span className="label mr-3 text-faint">{String(i + 1).padStart(2, "0")}</span>}
          {item.title}
        </dt>
        <dd className="text-[0.9875rem] leading-relaxed text-steel">{item.detail}</dd>
      </div>
    ))}
  </dl>
);

export default async function CaseStudyPage({ params }: { params: Promise<{ slug: string }> }) {
  const { slug } = await params;
  const project = getProject(slug);
  if (!project?.caseStudy) notFound();
  const study = project.caseStudy;

  const all = caseStudyProjects();
  const next = all[(all.findIndex((p) => p.slug === project.slug) + 1) % all.length];

  const meta = [
    { label: "Role", value: project.role },
    { label: "Context", value: project.context },
    { label: "Year", value: project.year },
  ].filter((item) => item.value);

  // Only blocks with content are rendered, and they are numbered in the order they appear.
  const blocks: { title: string; body: React.ReactNode }[] = [
    { title: "The problem", body: <Paragraphs items={study.problem} /> },
    { title: "The approach", body: <Paragraphs items={study.approach} /> },
    ...(project.figure ? [{ title: "System", body: <ProjectFigure figure={project.figure} /> }] : []),
    ...(study.architecture?.length ? [{ title: "System architecture", body: <Notes items={study.architecture} /> }] : []),
    ...(study.decisions?.length ? [{ title: "Engineering decisions", body: <Notes items={study.decisions} numbered /> }] : []),
    ...(study.reliability?.length ? [{ title: "Implementation and reliability", body: <Bullets items={study.reliability} /> }] : []),
    ...(study.outcome?.length ? [{ title: "Results so far", body: <Bullets items={study.outcome} /> }] : []),
    ...(study.limitations?.length ? [{ title: "Limitations", body: <Bullets items={study.limitations} /> }] : []),
    ...(study.learnings?.length ? [{ title: "What I learned", body: <Bullets items={study.learnings} /> }] : []),
    ...(study.next?.length ? [{ title: "What comes next", body: <Bullets items={study.next} /> }] : []),
  ];

  return (
    <article className="section" data-tone="teal" {...programmeScope(project.theme)}>
      <div
        className="shell pb-[clamp(4rem,8vw,7rem)] pt-[calc(var(--header-h)+clamp(2rem,5vw,4rem))]"
        style={{ "--enter-base": "200ms" } as React.CSSProperties}
      >
      <Link
        href="/work"
        className="group label enter-fade inline-flex min-h-11 items-center gap-2 text-steel transition-colors duration-[var(--dur-fast)] hover:text-rosso-bright"
      >
        <Icon
          name="arrow-left"
          size={14}
          className="transition-transform duration-[var(--dur-fast)] ease-[var(--ease-snap)] group-hover:-translate-x-0.5"
        />
        All work
      </Link>

      {/* The first viewport is one timed entrance under the route veil: status, title, tagline,
          then the facts — the same order a sector arrives in on the homepage. */}
      <header className="mt-6 pb-[clamp(2.5rem,5vw,4rem)]">
        <div className="enter flex flex-wrap items-center gap-x-6 gap-y-2">
          <StatusBadge status={project.status} />
          <p className="label text-faint">{project.discipline ?? "Case study"}</p>
        </div>
        <h1
          className="display enter-mask mt-5 max-w-[14ch] text-[clamp(2.375rem,6vw,5.25rem)] tracking-[-0.045em]"
          style={{ "--enter-index": 1 } as React.CSSProperties}
        >
          {project.title}
        </h1>
        {project.fullTitle && (
          <p className="label enter mt-4 max-w-[40rem] text-steel" style={{ "--enter-index": 2 } as React.CSSProperties}>
            {project.fullTitle}
          </p>
        )}
        <p
          className="enter mt-6 max-w-[44rem] text-[clamp(1.125rem,1.8vw,1.5rem)] leading-snug tracking-[-0.015em] text-bone"
          style={{ "--enter-index": 2 } as React.CSSProperties}
        >
          {project.tagline}
        </p>
        {project.statusNote && (
          <p
            className="enter mt-6 max-w-[40rem] border-l border-champagne pl-4 text-[0.9375rem] leading-snug text-steel"
            style={{ "--enter-index": 3 } as React.CSSProperties}
          >
            {project.statusNote}
          </p>
        )}

        <div
          className="enter mt-10 grid gap-x-10 gap-y-8 border-t border-rule pt-6 lg:grid-cols-12"
          style={{ "--enter-index": 3 } as React.CSSProperties}
        >
          <dl className="grid grid-cols-[5.5rem_1fr] content-start gap-y-2 lg:col-span-5">
            {meta.map((item) => (
              <div key={item.label} className="contents">
                <dt className="label pt-0.5 text-faint">{item.label}</dt>
                <dd className="text-[0.9375rem] text-bone">{item.value}</dd>
              </div>
            ))}
          </dl>
          <div className="lg:col-span-7">
            <TagList items={project.stack} label={`${project.title} technologies`} />
            {(project.links.repo || project.links.demo) && (
              <div className="mt-6 flex flex-wrap gap-3">
                {project.links.repo && (
                  <ButtonLink href={project.links.repo} icon="arrow-up-right">
                    Repository
                  </ButtonLink>
                )}
                {project.links.demo && (
                  <ButtonLink href={project.links.demo} variant="secondary" icon="arrow-up-right">
                    Live
                  </ButtonLink>
                )}
              </div>
            )}
          </div>
        </div>

        {project.facts && project.facts.length > 0 && (
          <dl className="mt-12 grid gap-x-10 gap-y-6 sm:grid-cols-2 lg:grid-cols-4">
            {project.facts.map((fact, index) => (
              <div
                key={fact.label}
                className="border-t border-[rgb(var(--prog,233_231_225)/0.45)] pt-3"
                data-reveal="settle"
                style={{ "--reveal-index": index } as React.CSSProperties}
              >
                <dt className="label text-faint">{fact.label}</dt>
                <dd className="mt-2 text-[0.9875rem] leading-snug text-bone">{fact.value}</dd>
              </div>
            ))}
          </dl>
        )}
      </header>

      {blocks.map((block, i) => (
        <Block key={block.title} index={i + 1} title={block.title}>
          {block.body}
        </Block>
      ))}

      {next && next.slug !== project.slug && (
        <nav aria-label="Next case study" className="relative pt-8">
          <span aria-hidden="true" className="absolute inset-x-0 top-0 h-px bg-rule-strong" data-reveal="trace" />
          <p className="label text-faint" data-reveal="snap">
            Next case study
          </p>
          <Link
            href={`/work/${next.slug}`}
            className="group mt-3 inline-flex items-center gap-4 transition-colors duration-[var(--dur-fast)] hover:text-rosso-bright"
            data-reveal="mask"
          >
            <span className="mask display text-[clamp(1.75rem,4vw,3.25rem)] tracking-[-0.04em]">{next.title}</span>
            <Icon
              name="arrow-right"
              size={32}
              className="transition-transform duration-[var(--dur-base)] ease-[var(--ease-out)] group-hover:translate-x-2"
            />
          </Link>
        </nav>
      )}
      </div>
    </article>
  );
}
