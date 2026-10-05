import type { CSSProperties } from "react";
import type { ProgrammeTheme } from "@/content";

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

export const PROGRAMME_PALETTE: Record<ProgrammeTheme, ProgrammePalette> = {
  // Evidence, retrieval, knowledge: technical teal with a red marker.
  evidence: { primary: "60 207 192", secondary: "215 38 47" },
  // Signal, neural topology, frequency: deep blue with cyan.
  signal: { primary: "79 157 255", secondary: "96 214 230" },
  // Market data, quantitative signals: restrained green with cyan, on graphite.
  market: { primary: "88 201 139", secondary: "60 207 192" },
};

/** Where the last programme's colour goes: back to the structure of the page. */
export const NEUTRAL_PALETTE: ProgrammePalette = { primary: "143 152 158", secondary: "77 87 93" };

/** Scopes a programme's identity to an element: spread onto its root. */
export function programmeScope(theme: ProgrammeTheme | undefined): { style?: CSSProperties; "data-programme"?: ProgrammeTheme } {
  if (!theme) return {};
  const { primary, secondary } = PROGRAMME_PALETTE[theme];
  return {
    "data-programme": theme,
    style: { "--prog": primary, "--prog-2": secondary } as CSSProperties,
  };
}

/** "01", "02" … — a programme's position in the featured sequence. */
export const programmeNumber = (index: number): string => String(index + 1).padStart(2, "0");
