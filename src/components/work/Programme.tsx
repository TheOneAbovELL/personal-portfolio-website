import Link from "next/link";
import { ButtonLink } from "@/components/ui/Button";
import { projectHref, research, type Project } from "@/content";
import { reveal } from "@/lib/reveal";
import { ProgrammeBrief } from "./ProgrammeBrief";
import { ProgrammeStatus } from "./ProgrammeStatus";
import { ProjectFigure } from "./ProjectFigure";
import { SignalChain } from "./SignalChain";
import { MarketTape } from "./signatures/MarketTape";
import { RippleField } from "./signatures/RippleField";
import { SatPass } from "./signatures/SatPass";
import { PROGRAMME_PALETTE, programmeNumber, programmeScope } from "./theme";

/**
 * How a programme is arranged on wide screens (styles/work.css → "Programme compositions").
 * The sequence cycles through them so consecutive programmes never share a layout.
 */
const COMPOSITIONS = ["lead", "mirror", "bleed"] as const;

/**
 * Each programme enters in its own way (v7) rather than through a chain of shared bands:
 *   evidence, signal   their v5 reveals, and Legal Lens hands over to qEEG (SelectedWork)
 *   ripple             RippleField — damped waves leave the changed fact and cross the section
 *   orbital            SatPass — a satellite swath reads the figure in as a resolving mosaic
 *   market             MarketTape — the series drawn in across the full width, with a ticker
 *   /projects themes   a light scroll-linked entrance of their own (styles/work.css)
 * Figures with a scroll-linked entrance skip the time-based reveal, so only one thing moves them.
 */
const TIMED_FIGURE = new Set(["evidence", "signal", "market"]);

interface ProgrammeProps {
  project: Project;
  /** Position in the featured sequence, from 0. */
  index: number;
  total: number;
}

/**
 * A featured project as an engineering programme: numeral, name, designation, the system
 * figure, a brief, and the way into the case study. Its root carries the programme's colours
 * as custom properties and, for the race environment, as `data-race-light`.
 */
export function Programme({ project, index, total }: ProgrammeProps) {
  const number = programmeNumber(index);
  const composition = COMPOSITIONS[index % COMPOSITIONS.length];
  const href = projectHref(project);
  const titleId = `work-${project.slug}`;

  return (
    <article
      aria-labelledby={titleId}
      className="programme"
      data-composition={composition}
      data-race-light={project.theme ? PROGRAMME_PALETTE[project.theme].primary : undefined}
      {...programmeScope(project.theme)}
    >
      {project.theme === "market" && <MarketTape />}
      <div className="prog-rule" aria-hidden="true" data-reveal="trace" />
      <div className="mt-4 flex flex-wrap items-baseline justify-between gap-x-8 gap-y-2" {...reveal("snap")}>
        <p className="label text-steel">
          <span className="prog-ink">Programme {number}</span>
          <span className="text-faint"> / {programmeNumber(total - 1)}</span>
          {project.discipline && (
            <>
              <span aria-hidden="true" className="mx-2 text-metal-3">
                ·
              </span>
              {project.discipline}
            </>
          )}
        </p>
        <ProgrammeStatus status={project.status} />
      </div>

      <div className="prog-grid">
        <header className="prog-head">
          <p className="prog-numeral display" aria-hidden="true" {...reveal("settle")}>
            {number}
          </p>
          <h3 id={titleId} className="prog-title display" {...reveal("mask")}>
            <span className="mask">
              <Link href={href} className="transition-colors duration-[var(--dur-fast)] hover:text-rosso-bright">
                {project.title}
              </Link>
            </span>
          </h3>
          <p className="prog-designation label text-[0.75rem] text-bone" {...reveal("snap", 2)}>
            <span aria-hidden="true" className="prog-bg mr-3 inline-block h-px w-8 align-middle" />
            {project.designation ?? project.tagline}
          </p>
        </header>

        {project.slug === research.project && <SignalChain />}

        {project.figure && (
          <div className="prog-figure" {...(!project.theme || TIMED_FIGURE.has(project.theme) ? reveal("settle", 1) : {})}>
            <ProjectFigure figure={project.figure} wide={composition === "bleed"} />
            {project.theme === "ripple" && <RippleField />}
            {project.theme === "orbital" && <SatPass />}
          </div>
        )}

        <div className="prog-brief" {...reveal("rise", 1)}>
          <ProgrammeBrief project={project} />
          <div className="prog-actions">
            <ButtonLink href={href} icon="arrow-right" aria-label={`Open case study: ${project.title}`}>
              Open case study
            </ButtonLink>
            {project.links.repo && (
              <ButtonLink
                href={project.links.repo}
                variant="secondary"
                icon="arrow-up-right"
                aria-label={`Repository: ${project.title} on GitHub`}
              >
                Repository
              </ButtonLink>
            )}
            {project.links.demo && (
              <ButtonLink
                href={project.links.demo}
                variant="secondary"
                icon="arrow-up-right"
                aria-label={`Live: ${project.title} demo`}
              >
                Live
              </ButtonLink>
            )}
          </div>
        </div>
      </div>
    </article>
  );
}
