/**
 * What the navigator shows, computed on the server from `src/content` (components/layout/
 * Header.tsx) so the client bundle carries a few hundred bytes of labels, not the projects.
 */

export interface NavSector {
  id: string;
  /** "01" … in `site.sections` order. */
  number: string;
  label: string;
  note: string;
  href: string;
  /** Has a toggle in the header's sector pill. */
  pill: boolean;
}

/** A toggle in the header pill away from the homepage. */
export interface NavLink {
  href: string;
  label: string;
}

export interface NavPage {
  href: string;
  label: string;
  note: string;
}

export interface NavProgramme {
  /** "01" … the programme's place in the whole sequence. */
  number: string;
  slug: string;
  title: string;
  tagline: string;
  discipline: string | null;
  status: string;
  href: string;
  /** "r g b" triplets from the programme's identity (components/work/theme.ts). */
  primary: string;
  secondary: string;
  /** Homepage programmes, or the ones on /projects. */
  group: "home" | "projects";
}

export interface NavSocial {
  id: string;
  label: string;
  handle: string;
  href: string;
}

export interface NavData {
  name: string;
  email: string;
  resumeHref: string;
  sectors: NavSector[];
  pages: NavPage[];
  headerPages: NavLink[];
  programmes: NavProgramme[];
  socials: NavSocial[];
}
