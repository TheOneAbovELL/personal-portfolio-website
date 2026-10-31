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

  /** Homepage sections, in order. `id` is the anchor; `nav` controls header visibility. */
  sections: [
    { id: "about", label: "About", nav: true },
    { id: "capabilities", label: "Capabilities", nav: true },
    { id: "ask", label: "Ask", nav: true },
    { id: "work", label: "Work", nav: true },
    { id: "experience", label: "Experience", nav: true },
    { id: "garage", label: "Garage", nav: true },
    { id: "contact", label: "Contact", nav: true },
  ],

  /**
   * Pages that are not homepage sectors but sit in the header beside them. They take no
   * sector number and no segment of the sector bar; `after` names the sector they follow.
   */
  routes: [{ href: "/projects", label: "Projects", after: "work" }],

} as const;

export type SectionId = (typeof site.sections)[number]["id"];
