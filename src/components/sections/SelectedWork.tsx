import Link from "next/link";
import { Fragment } from "react";
import { Section } from "@/components/layout/Section";
import { Icon } from "@/components/ui/Icon";
import { Morph } from "@/components/work/Morph";
import type { MorphKind } from "@/components/work/morph-shapes";
import { Programme } from "@/components/work/Programme";
import { NEUTRAL_PALETTE, PROGRAMME_PALETTE, programmeNumber } from "@/components/work/theme";
import { featuredProjects, type ProgrammeTheme } from "@/content";
import { ResearchDirection } from "./Research";

/**
 * What a programme's material turns into as the page leaves it (DATA_MORPH):
 * documents become signal, waveforms become a chart, and the chart flattens into the grid
 * that the research block is drawn on.
 */
const TRANSITION_OUT: Record<ProgrammeTheme, MorphKind> = {
  evidence: "information-signal",
  signal: "waveform-chart",
  market: "chart-grid",
};

/**
 * The Work sector: the featured programmes in sequence, each handed to the next by its own
 * transition, then research and direction, then the way to everything smaller.
 */
export function SelectedWork() {
  const featured = featuredProjects();

  return (
    <Section
      id="work"
      label="Featured engineering"
      title="Systems built to be measured."
      readout={`${programmeNumber(featured.length - 1)} programmes`}
      tone="yellow"
      layout="wide"
      aside={
        <Link
          href="/work"
          className="label group inline-flex min-h-11 items-center gap-2 text-steel transition-colors duration-[var(--dur-fast)] hover:text-signal"
        >
          All case studies
          <Icon
            name="arrow-right"
            size={14}
            className="transition-transform duration-[var(--dur-fast)] ease-[var(--ease-snap)] group-hover:translate-x-1"
          />
        </Link>
      }
    >
      {featured.map((project, index) => {
        const next = featured[index + 1];
        return (
          <Fragment key={project.slug}>
            <Programme project={project} index={index} total={featured.length} />
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

      <ResearchDirection />

      <p className="mt-12 flex flex-wrap items-baseline gap-x-3 gap-y-1 border-t border-rule pt-6 text-[0.9375rem] text-steel">
        Everything smaller — experiments, tools, hackathon builds — lives in the
        <Link
          href="#garage"
          className="label group inline-flex min-h-11 items-center gap-2 text-bone transition-colors duration-[var(--dur-fast)] hover:text-signal"
        >
          Garage
          <Icon
            name="arrow-down"
            size={14}
            className="transition-transform duration-[var(--dur-fast)] ease-[var(--ease-snap)] group-hover:translate-y-0.5"
          />
        </Link>
      </p>
    </Section>
  );
}
