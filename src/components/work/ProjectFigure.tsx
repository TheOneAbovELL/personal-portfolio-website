import { AgentTraceFigure } from "@/components/figures/builds/AgentTraceFigure";
import { AttentionMasksFigure } from "@/components/figures/builds/AttentionMasksFigure";
import { ChessBoardFigure } from "@/components/figures/builds/ChessBoardFigure";
import { ContextWindowFigure } from "@/components/figures/builds/ContextWindowFigure";
import { HeadCircuitFigure } from "@/components/figures/builds/HeadCircuitFigure";
import { RaceReplayFigure } from "@/components/figures/builds/RaceReplayFigure";
import { RunCompareFigure } from "@/components/figures/builds/RunCompareFigure";
import { MontageFigure } from "@/components/figures/MontageFigure";
import { PipelineFigure } from "@/components/figures/PipelineFigure";
import { RiskFigure } from "@/components/figures/RiskFigure";
import type { ProjectFigure as FigureId } from "@/content";
import { BuildCaption } from "./BuildCaption";

interface FigureEntry {
  /**
   * Figures are numbered in the order they appear down the homepage (Fig. 01 is the hero's),
   * then on through /projects, so the whole body of work reads as one sequence.
   */
  number: string;
  caption: React.ReactNode;
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

  // /projects, in programme order (04–10). Each figure module owns its honest caption,
  // read on the client by BuildCaption (the modules are client components).
  "agent-trace": {
    number: "05",
    caption: <BuildCaption figure="agent-trace" />,
    render: (wide) => <AgentTraceFigure wide={wide} />,
  },
  "run-compare": {
    number: "06",
    caption: <BuildCaption figure="run-compare" />,
    render: (wide) => <RunCompareFigure wide={wide} />,
  },
  "context-window": {
    number: "07",
    caption: <BuildCaption figure="context-window" />,
    render: (wide) => <ContextWindowFigure wide={wide} />,
  },
  "head-circuit": {
    number: "08",
    caption: <BuildCaption figure="head-circuit" />,
    render: (wide) => <HeadCircuitFigure wide={wide} />,
  },
  "attention-masks": {
    number: "09",
    caption: <BuildCaption figure="attention-masks" />,
    render: (wide) => <AttentionMasksFigure wide={wide} />,
  },
  "chess-board": {
    number: "10",
    caption: <BuildCaption figure="chess-board" />,
    render: (wide) => <ChessBoardFigure wide={wide} />,
  },
  "race-replay": {
    number: "11",
    caption: <BuildCaption figure="race-replay" />,
    render: (wide) => <RaceReplayFigure wide={wide} />,
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
