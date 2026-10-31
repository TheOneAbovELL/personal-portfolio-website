/**
 * Site-level configuration: canonical URL, SEO copy and navigation.
 *
 * The canonical URL resolves in this order:
 *   1. NEXT_PUBLIC_SITE_URL       — set this in Vercel once a custom domain is attached
 *   2. VERCEL_PROJECT_PRODUCTION_URL — provided automatically by Vercel
 *   3. http://localhost:3000      — local development
 */
function resolveSiteUrl(): string {
  const explicit = process.env.NEXT_PUBLIC_SITE_URL;
  if (explicit) return explicit.replace(/\/$/, "");
  const vercel = process.env.VERCEL_PROJECT_PRODUCTION_URL;
  if (vercel) return `https://${vercel}`;
  return "http://localhost:3000";
}

export const site = {
  url: resolveSiteUrl(),
  title: "Omjee R Giri — AI / ML Engineer",
  titleTemplate: "%s — Omjee R Giri",
  description:
    "Omjee R Giri is an engineering student building intelligent systems and the engineering underneath them: retrieval pipelines, ML research and reliable backends.",
  locale: "en",

  /**
   * Homepage sections, in order. `id` is the anchor; `nav` lists it in the navigator; `pill`
   * gives it a toggle in the header's sector pill; `note` is the one line the navigator shows
   * beside it.
   */
  sections: [
    { id: "about", label: "About", nav: true, pill: true, note: "Background, and how the work gets done" },
    { id: "capabilities", label: "Capabilities", nav: true, pill: true, note: "Tools and methods, with the evidence" },
    { id: "ask", label: "Ask", nav: true, pill: false, note: "Question the portfolio directly" },
    { id: "work", label: "Work", nav: true, pill: true, note: "The homepage programmes" },
    { id: "experience", label: "Experience", nav: true, pill: true, note: "Research, open source, education" },
    { id: "garage", label: "Garage", nav: true, pill: true, note: "Every public repository, synced from GitHub" },
    { id: "contact", label: "Contact", nav: true, pill: true, note: "Email and profiles" },
  ],

  /** The header pill away from the homepage: the pages, and the way back. */
  headerPages: [
    { href: "/", label: "Home" },
    { href: "/projects", label: "Projects" },
    { href: "/work", label: "Work" },
    { href: "/#garage", label: "Garage" },
  ],

  /**
   * Pages beside the sectors. They take no sector number and no segment of the sector bar;
   * `after` names the sector they follow.
   */
  routes: [
    { href: "/projects", label: "Projects", after: "work", note: "The programmes that continue the sequence" },
    { href: "/work", label: "All work", after: "work", note: "Every project, case studies and archive" },
    { href: "/#garage", label: "Garage", after: "garage", note: "Smaller builds and experiments" },
  ],
} as const;

export type SectionId = (typeof site.sections)[number]["id"];
