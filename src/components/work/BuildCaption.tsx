"use client";

import { CAPTION as AGENT_TRACE } from "@/components/figures/builds/AgentTraceFigure";
import { CAPTION as ATTENTION_MASKS } from "@/components/figures/builds/AttentionMasksFigure";
import { CAPTION as CHESS_BOARD } from "@/components/figures/builds/ChessBoardFigure";
import { CAPTION as CONTEXT_WINDOW } from "@/components/figures/builds/ContextWindowFigure";
import { CAPTION as HEAD_CIRCUIT } from "@/components/figures/builds/HeadCircuitFigure";
import { CAPTION as RACE_REPLAY } from "@/components/figures/builds/RaceReplayFigure";
import { CAPTION as REC_ENGINE } from "@/components/figures/builds/RecEngineFigure";
import { CAPTION as RIPPLE } from "@/components/figures/builds/RippleFigure";
import { CAPTION as RUN_COMPARE } from "@/components/figures/builds/RunCompareFigure";
import { CAPTION as SATQUERY } from "@/components/figures/builds/SatQueryFigure";

/** The bespoke build figures, each of which owns its caption. */
export type BuildFigure =
  | "ripple"
  | "satquery"
  | "agent-trace"
  | "run-compare"
  | "context-window"
  | "head-circuit"
  | "attention-masks"
  | "chess-board"
  | "race-replay"
  | "rec-engine";

const CAPTIONS: Record<BuildFigure, string> = {
  ripple: RIPPLE,
  satquery: SATQUERY,
  "agent-trace": AGENT_TRACE,
  "run-compare": RUN_COMPARE,
  "context-window": CONTEXT_WINDOW,
  "head-circuit": HEAD_CIRCUIT,
  "attention-masks": ATTENTION_MASKS,
  "chess-board": CHESS_BOARD,
  "race-replay": RACE_REPLAY,
  "rec-engine": REC_ENGINE,
};

/**
 * A build figure's caption, read from the figure's own module. The figure modules are client
 * modules, so their `CAPTION` strings are only real values on the client side of the boundary —
 * a server component importing them would receive client references, not text.
 */
export function BuildCaption({ figure }: { figure: BuildFigure }) {
  return <>{CAPTIONS[figure]}</>;
}
