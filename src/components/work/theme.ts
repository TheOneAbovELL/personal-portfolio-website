import type { CSSProperties } from "react";
import type { ProjectTheme } from "@/content";

/**
 * Programme identities — a restrained pair of colours for each featured programme, inside the
 * master palette (docs/RACE-SYSTEM.md §5). They are the single source for three consumers:
 * the CSS custom properties scoped to a programme (`--prog`, `--prog-2`), the transition that
 * carries one programme into the next, and the light the race environment shifts to.
 *
 * Values are "r g b" triplets because all three consumers need to apply their own alpha.
 */
export type RgbTriplet = `${number} ${number} ${number}`;

export interface ProgrammePalette {
  /** Leads: numeral, rules, figure highlights, the environment's light. */
  primary: RgbTriplet;
  /** A controlled second voice. Markers and single lines only — never text on its own. */
  secondary: RgbTriplet;
}

export const PROGRAMME_PALETTE: Record<ProjectTheme, ProgrammePalette> = {
  // Evidence, retrieval, knowledge: technical teal with a red marker.
  evidence: { primary: "60 207 192", secondary: "215 38 47" },
  // Signal, neural topology, frequency: deep blue with cyan.
  signal: { primary: "79 157 255", secondary: "96 214 230" },
  // Market data, quantitative signals: restrained green with cyan, on graphite.
  market: { primary: "88 201 139", secondary: "60 207 192" },

  // The /projects programmes (04–10), in sequence.
  // Agent traces and grading: racing yellow, with red for a failed check.
  trace: { primary: "242 194 48", secondary: "215 38 47" },
  // Evaluation runs compared: teal, with yellow for the run being compared against.
  bench: { primary: "60 207 192", secondary: "242 194 48" },
  // Context windows and positional encodings: violet with cyan.
  context: { primary: "167 139 250", secondary: "96 214 230" },
  // Circuits inside a Transformer: magenta with violet.
  circuit: { primary: "244 114 182", secondary: "167 139 250" },
  // Attention patterns and their costs: deep blue with papaya.
  attention: { primary: "79 157 255", secondary: "255 122 26" },
  // The board: bone with green for the engine's line.
  chess: { primary: "233 231 225", secondary: "88 201 139" },
  // Race telemetry: racing red with yellow.
  telemetry: { primary: "215 38 47", secondary: "242 194 48" },
};

/** Where the last programme's colour goes: back to the structure of the page. */
export const NEUTRAL_PALETTE: ProgrammePalette = { primary: "143 152 158", secondary: "77 87 93" };

/** Scopes a programme's identity to an element: spread onto its root. */
export function programmeScope(theme: ProjectTheme | undefined): { style?: CSSProperties; "data-programme"?: ProjectTheme } {
  if (!theme) return {};
  const { primary, secondary } = PROGRAMME_PALETTE[theme];
  return {
    "data-programme": theme,
    style: { "--prog": primary, "--prog-2": secondary } as CSSProperties,
  };
}

/** "01", "02" … — a programme's position in the sequence (homepage 01–03, then /projects). */
export const programmeNumber = (index: number): string => String(index + 1).padStart(2, "0");
