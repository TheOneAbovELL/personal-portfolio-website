import { MontageFigure } from "@/components/figures/MontageFigure";
import { PipelineFigure } from "@/components/figures/PipelineFigure";
import { RiskFigure } from "@/components/figures/RiskFigure";
import type { ProjectFigure as FigureId } from "@/content";

interface FigureEntry {
  /** Figures are numbered in the order they appear down the homepage (Fig. 01 is the hero's). */
  number: string;
  caption: string;
  render: (wide: boolean) => React.ReactNode;
}

const FIGURES: Record<FigureId, FigureEntry> = {
  pipeline: {
    number: "02",
    caption:
      "The request pipeline, stage by stage. Switch complexity to see how routing changes retrieval; gates are the stages that can end a request.",
    render: () => <PipelineFigure />,
  },
  montage: {
    number: "03",
    caption:
      "Channel traces and the 19 electrodes of the 10–20 system as a graph. Traces and edges are schematic, not recorded data; in the model, adjacency comes from measured coherence.",
    render: () => <MontageFigure />,
  },
  risk: {
    number: "04",
    caption:
      "Illustrative series — generated, not market data. The metrics are computed from it using the engine's definitions.",
    render: (wide) => <RiskFigure wide={wide} />,
  },
};

interface ProjectFigureProps {
  figure: FigureId;
  /** The figure has the full measure to itself; figures that can use the width lay out for it. */
  wide?: boolean;
}

/** A project's bespoke figure in a framed panel with a numbered, honest caption. */
export function ProjectFigure({ figure, wide = false }: ProjectFigureProps) {
  const { number, caption, render } = FIGURES[figure];
  return (
    <div className="panel">
      <div className="p-4 sm:p-6">{render(wide)}</div>
      <p className="label weave border-t border-rule px-4 py-3 text-faint sm:px-6">
        <span className="prog-ink">Fig. {number}</span> — {caption}
      </p>
    </div>
  );
}
