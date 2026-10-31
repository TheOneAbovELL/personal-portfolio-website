import Link from "next/link";
import { Fragment } from "react";
import { Section } from "@/components/layout/Section";
import { Icon } from "@/components/ui/Icon";
import { Morph } from "@/components/work/Morph";
import { Programme } from "@/components/work/Programme";
import { NEUTRAL_PALETTE, PROGRAMME_PALETTE, programmeNumber } from "@/components/work/theme";
import { featuredProjects } from "@/content";
import { ResearchDirection } from "./Research";

/**
 * v7: one band remains — Legal Lens's documents become qEEG's signal (DATA_MORPH), the
 * hand-over the owner approved. Every later programme carries its own signature entrance
 * instead (components/work/signatures), so each reads as its own chapter, and the sequence
 * ends calmly into research.
 */
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
          className="label group inline-flex min-h-11 items-center gap-2 text-steel transition-colors duration-[var(--dur-fast)] hover:text-rosso-bright"
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
            {project.theme === "evidence" && (
              <Morph
                kind="information-signal"
                from={PROGRAMME_PALETTE.evidence}
                to={next?.theme ? PROGRAMME_PALETTE[next.theme] : NEUTRAL_PALETTE}
              />
            )}
          </Fragment>
        );
      })}

      <div className="mt-[clamp(4rem,9vw,8rem)]">
        <ResearchDirection />
      </div>

      <p className="mt-12 flex flex-wrap items-baseline gap-x-3 gap-y-1 border-t border-rule pt-6 text-[0.9375rem] text-steel">
        Everything smaller — experiments, tools, hackathon builds — lives in the
        <Link
          href="#garage"
          className="label group inline-flex min-h-11 items-center gap-2 text-bone transition-colors duration-[var(--dur-fast)] hover:text-rosso-bright"
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
