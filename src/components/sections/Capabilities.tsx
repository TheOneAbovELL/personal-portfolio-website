import { Section } from "@/components/layout/Section";
import { projectHref, skills, visibleProjects, type Project } from "@/content";
import { skillAliases, skillUses } from "@/content/skills";
import { reveal } from "@/lib/reveal";
import { CapabilityConsole, type CapabilityDomainView, type CapabilityUse } from "./CapabilityConsole";

const norm = (value: string) => value.toLowerCase().replace(/[^a-z0-9+#]/g, "");

/** Site order: homepage programmes, then /projects programmes, then the rest. */
const rankOf = (project: Project) => (project.featured ? 0 : project.showcase ? 100 : 200) + project.order;

/** Where a project sits on the site, as a short tag. */
function placeOf(project: Project): string {
  if (project.featured) return "Programme";
  if (project.showcase) return "Project";
  return "Garage";
}

/**
 * Resolve every tool of every domain to the places it was used. Hand-written notes in
 * content/skills.ts come first (they say how); tools named in a project's stack are matched
 * automatically and described by the project's own tagline. A project that is hidden, or not
 * yet in content/projects.ts, simply drops out.
 */
function buildDomains(): CapabilityDomainView[] {
  const projects = visibleProjects();
  const bySlug = new Map(projects.map((project) => [project.slug, project]));

  const usesOf = (item: string): CapabilityUse[] => {
    const uses: CapabilityUse[] = [];
    const seen = new Set<string>();

    for (const use of skillUses[item] ?? []) {
      if (use.slug) {
        const project = bySlug.get(use.slug);
        if (!project || seen.has(project.slug)) continue;
        seen.add(project.slug);
        uses.push({
          key: project.slug,
          title: project.title,
          href: projectHref(project),
          note: use.note,
          place: placeOf(project),
          rank: rankOf(project),
        });
      } else if (use.source) {
        uses.push({ key: `src:${use.source}`, title: use.source, href: use.href, note: use.note, place: "Experience" });
      }
    }

    const names = new Set([item, ...(skillAliases[item] ?? [])].map(norm));
    for (const project of projects) {
      if (seen.has(project.slug)) continue;
      if (!project.stack.some((tech) => names.has(norm(tech)))) continue;
      seen.add(project.slug);
      uses.push({
        key: project.slug,
        title: project.title,
        href: projectHref(project),
        note: project.tagline,
        place: placeOf(project),
        rank: rankOf(project),
      });
    }
    return uses;
  };

  return skills.map((domain) => {
    const tools = domain.items.map((name) => ({ name, uses: usesOf(name) }));
    return {
      id: domain.id,
      title: domain.title,
      summary: domain.summary,
      tools,
      evidence: domain.evidence.map((e) => ({ key: `ev:${e.source}`, title: e.source, href: e.href, note: e.note, place: "" })),
    };
  });
}

/**
 * Capabilities, always tied to evidence. An explorer rather than a list: pick a domain, then a
 * tool, and see every place it was used and how — or switch to the map of domains × projects.
 */
export function Capabilities() {
  const domains = buildDomains();
  const tools = new Set(domains.flatMap((domain) => domain.tools.map((tool) => tool.name)));

  return (
    <Section
      id="capabilities"
      label="Capabilities"
      title="What I work with — and the work that proves it."
      readout={`${String(skills.length).padStart(2, "0")} domains · ${tools.size} tools and concepts`}
      tone="teal"
      layout="wide"
    >
      <div {...reveal("rise")}>
        <CapabilityConsole domains={domains} />
      </div>
    </Section>
  );
}
