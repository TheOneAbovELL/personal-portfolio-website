import type { Metadata } from "next";
import Link from "next/link";
import { Fragment } from "react";
import { SectorLine } from "@/components/layout/Section";
import { Icon } from "@/components/ui/Icon";
import { Morph } from "@/components/work/Morph";
import type { MorphKind } from "@/components/work/morph-shapes";
import { Programme } from "@/components/work/Programme";
import { NEUTRAL_PALETTE, PROGRAMME_PALETTE, programmeNumber } from "@/components/work/theme";
import { featuredProjects, showcaseProjects, type ShowcaseTheme } from "@/content";

export const metadata: Metadata = {
  title: "Projects",
  description:
    "Programmes 06 to 13 by Omjee R Giri: agent and RAG evaluation workbenches, three research laboratories on how Transformers attend, builds for the board and the track, and an explainable recommender — each with its real status.",
  alternates: { canonical: "/projects" },
};

/**
 * What each programme's material turns into as the page leaves it (DATA_MORPH, as on the
 * homepage): a trace resolves into score bars, bars break into tokens, the window into
 * attention arcs, layers into a matrix, cost curves into a board, the board into a track,
 * the track straightens into an embedding neighbourhood, and the shortlist levels out into the
 * grid the page is drawn on.
 */
const TRANSITION_OUT: Record<ShowcaseTheme, MorphKind> = {
  trace: "trace-bars",
  bench: "bars-context",
  context: "context-attention",
  circuit: "circuit-matrix",
  attention: "curves-board",
  chess: "board-track",
  telemetry: "track-neighbours",
  recommend: "neighbours-grid",
};

const linkClass =
  "label group inline-flex min-h-11 items-center gap-2 text-bone transition-colors duration-[var(--dur-fast)] hover:text-signal";
const arrowClass =
  "transition-transform duration-[var(--dur-fast)] ease-[var(--ease-snap)] group-hover:translate-x-1";

/**
 * Programmes 06–13. The homepage carries 01–05; this page continues the same sequence with the
 * same parts — Programme, its figure, and a transition handing each one to the next — so the
 * whole body of work reads as one run.
 */
export default function ProjectsPage() {
  const offset = featuredProjects().length;
  const programmes = showcaseProjects();
  const total = offset + programmes.length;
  const first = programmeNumber(offset);
  const last = programmeNumber(total - 1);

  return (
    <div className="section" data-tone="yellow">
      <div className="shell pb-[clamp(4rem,8vw,7rem)] pt-[calc(var(--header-h)+clamp(3rem,7vw,6rem))]">
        <p className="label text-steel">
          <span className="text-signal">Index</span>
          <span aria-hidden="true" className="mx-2 text-metal-3">
            /
          </span>
          Programmes {first}–{last}
        </p>
        <h1 className="display enter-mask mt-5 text-[clamp(2.375rem,6vw,5.25rem)] uppercase">Projects</h1>
        <p
          className="prose-body enter mt-6 max-w-[40rem] text-steel"
          style={{ "--enter-index": 1 } as React.CSSProperties}
        >
          The sequence continues from the five programmes on the homepage: two workbenches that measure AI systems
          by what they actually do, three laboratories that take Transformers apart, two builds for the board and
          the track, and a recommender that explains its rankings. Each is described as it is — research, prototype
          or complete — with the code linked.
        </p>

        <div className="mt-[clamp(3.5rem,7vw,6rem)]">
          <SectorLine tone="yellow" />
          <div className="mt-4 flex items-baseline justify-between gap-6">
            <h2 className="label text-steel" data-reveal="snap">
              <span className="text-signal">
                {first}–{last}
              </span>
              <span aria-hidden="true" className="mx-2 text-metal-3">
                /
              </span>
              Further engineering
            </h2>
            <p className="label text-faint" data-reveal="snap" style={{ "--reveal-index": 2 } as React.CSSProperties}>
              {String(programmes.length).padStart(2, "0")} programmes
            </p>
          </div>
        </div>

        <div className="mt-[clamp(2.5rem,5vw,4.5rem)]">
          {programmes.map((project, index) => {
            const next = programmes[index + 1];
            return (
              <Fragment key={project.slug}>
                <Programme project={project} index={offset + index} total={total} />
                {project.theme && (
                  <Morph
                    kind={TRANSITION_OUT[project.theme]}
                    from={PROGRAMME_PALETTE[project.theme]}
                    to={next?.theme ? PROGRAMME_PALETTE[next.theme] : NEUTRAL_PALETTE}
                  />
                )}
              </Fragment>
            );
          })}
        </div>

        <nav
          aria-label="More work"
          className="mt-12 grid gap-y-2 border-t border-rule pt-6 text-[0.9375rem] text-steel sm:grid-cols-2 sm:gap-x-10"
        >
          <p className="flex flex-wrap items-baseline gap-x-3">
            Every project, with its real status, is in the index
            <Link href="/work" className={linkClass}>
              All work
              <Icon name="arrow-right" size={14} className={arrowClass} />
            </Link>
          </p>
          <p className="flex flex-wrap items-baseline gap-x-3">
            Everything smaller — experiments, tools, hackathon builds — lives in the
            <Link href="/#garage" className={linkClass}>
              Garage
              <Icon name="arrow-right" size={14} className={arrowClass} />
            </Link>
          </p>
        </nav>
      </div>
    </div>
  );
}
