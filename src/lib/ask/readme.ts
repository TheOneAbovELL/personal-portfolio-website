/**
 * README passages for the knowledge index.
 *
 * Each programme and Garage repository's README is fetched raw from GitHub, cached by Next's
 * fetch cache (revalidated with the rest of the GitHub data), stripped of markdown and cut
 * into short passages, one heading at a time. A README that cannot be fetched simply adds
 * nothing: the curated content still answers.
 */

import { splitSentences, wordCount } from "./text";
import type { KnowledgeDoc } from "./types";

export interface ReadmeTarget {
  /** "owner/name" on GitHub. */
  slug: string;
  /** The name the site uses, e.g. "Legal Lens" or a Garage repo title. */
  title: string;
  /** The repository's page — where a citation points. */
  url: string;
  /** "project:<slug>" or "repo:<name>". */
  entity: string;
}

const SIX_HOURS = 6 * 60 * 60;
/** Words per passage: long enough to carry a claim with its context, short enough to rank. */
const PASSAGE_WORDS = 90;
const MAX_PASSAGES = 8;
const MAX_README_CHARS = 60_000;

/** Sections that describe how to run or credit a project, not what it is. */
const SKIPPED_HEADING =
  /\b(licen[cs]e|contribut\w*|install\w*|setup|set up|getting started|quick ?start|running|run locally|local development|usage|commands?|acknowledg\w*|citation|cite|contact|table of contents|contents|requirements|prerequisites|environment|env vars?|configuration|deploy\w*|troubleshoot\w*|faq|authors?|credits?|screenshots?|demo credentials)\b/i;

/** Markdown to plain text, keeping heading boundaries as "\n# heading\n". */
export function stripMarkdown(markdown: string): string {
  return (
    markdown
      .slice(0, MAX_README_CHARS)
      .replace(/\r\n?/g, "\n")
      // Fenced code and diagrams: rarely prose, often box-drawing.
      .replace(/^(```|~~~)[\s\S]*?^\1[^\n]*$/gm, "")
      .replace(/<!--[\s\S]*?-->/g, "")
      // HTML headings become markdown headings; other tags keep their text.
      .replace(/<h[1-6][^>]*>([\s\S]*?)<\/h[1-6]>/gi, "\n# $1\n")
      .replace(/<br\s*\/?>/gi, "\n")
      .replace(/<\/?[a-z][^>]*>/gi, "")
      // Images and badges go; links keep their text.
      .replace(/!\[[^\]]*\]\([^)]*\)/g, "")
      .replace(/!\[[^\]]*\]\[[^\]]*\]/g, "")
      .replace(/\[([^\]]+)\]\([^)]*\)/g, "$1")
      .replace(/\[([^\]]+)\]\[[^\]]*\]/g, "$1")
      .replace(/^\s*\[[^\]]+\]:\s*\S+.*$/gm, "")
      // Setext headings.
      .replace(/^(.+)\n(=+|-+)\s*$/gm, "# $1")
      .split("\n")
      .map((line) => {
        const trimmed = line.trim();
        if (/^\|?\s*:?-{2,}:?\s*(\|\s*:?-{2,}:?\s*)*\|?$/.test(trimmed)) return "";
        if (/^#{1,6}\s/.test(trimmed)) return `\n# ${trimmed.replace(/^#{1,6}\s+/, "").replace(/#+$/, "").trim()}\n`;
        let text = trimmed
          .replace(/^>\s?/, "")
          .replace(/^([-*+]|\d+[.)])\s+(\[[ xX]\]\s+)?/, "")
          .replace(/^(-{3,}|\*{3,}|_{3,})$/, "");
        if (text.includes("|")) {
          text = text
            .split("|")
            .map((cell) => cell.trim())
            .filter(Boolean)
            .join(" — ");
        }
        text = text
          .replace(/`([^`]*)`/g, "$1")
          .replace(/(\*\*|__)(.*?)\1/g, "$2")
          .replace(/(^|[\s(])[*_]([^*_\n]+)[*_](?=[\s).,;:!?]|$)/g, "$1$2")
          .replace(/[│┌┐└┘├┤┬┴┼─━═║▶▼◀▲→←↓↑]+/g, " ")
          .replace(/\s{2,}/g, " ")
          .trim();
        // A line that is a fragment (a list item, a table row) still reads as a sentence.
        return text && !/[.!?:;]$/.test(text) && wordCount(text) > 2 ? `${text}.` : text;
      })
      .join("\n")
  );
}

interface Section {
  heading: string;
  lines: string[];
}

function sections(text: string): Section[] {
  const out: Section[] = [{ heading: "", lines: [] }];
  for (const line of text.split("\n")) {
    const heading = /^# (.+)$/.exec(line.trim());
    if (heading) out.push({ heading: heading[1].trim(), lines: [] });
    else if (line.trim()) out[out.length - 1].lines.push(line.trim());
  }
  return out.filter((section) => section.lines.length > 0);
}

/** Passages of about PASSAGE_WORDS words, cut at sentence boundaries. */
function passages(lines: string[]): string[] {
  const sentences = splitSentences(lines.join(" ")).filter((sentence) => wordCount(sentence) >= 3);
  const out: string[] = [];
  let current: string[] = [];
  let words = 0;
  for (const sentence of sentences) {
    const count = wordCount(sentence);
    if (words > 0 && words + count > PASSAGE_WORDS) {
      out.push(current.join(" "));
      current = [];
      words = 0;
    }
    current.push(sentence);
    words += count;
  }
  if (current.length > 0 && words >= 8) out.push(current.join(" "));
  return out;
}

/** README markdown → knowledge documents for one repository. */
export function readmeDocs(target: ReadmeTarget, markdown: string): KnowledgeDoc[] {
  const label = `Garage / ${target.title} / README`;
  const docs: KnowledgeDoc[] = [];
  for (const section of sections(stripMarkdown(markdown))) {
    if (section.heading && SKIPPED_HEADING.test(section.heading)) continue;
    for (const text of passages(section.lines)) {
      if (docs.length >= MAX_PASSAGES) return docs;
      docs.push({
        id: `readme:${target.slug}:${docs.length}`,
        type: "repo",
        title: section.heading ? `${target.title} README — ${section.heading}` : `${target.title} README`,
        label,
        href: target.url,
        // Below the curated content: a README is the source, the portfolio is the edit.
        importance: 0.8,
        entity: target.entity,
        tags: [target.title, "readme", "repository", ...(section.heading ? [section.heading] : [])],
        text,
      });
    }
  }
  return docs;
}

async function fetchReadme(slug: string): Promise<string | null> {
  try {
    const response = await fetch(`https://raw.githubusercontent.com/${slug}/HEAD/README.md`, {
      next: { revalidate: SIX_HOURS },
      signal: AbortSignal.timeout(5000),
    });
    if (!response.ok) return null;
    const text = await response.text();
    return text.trim() ? text : null;
  } catch {
    return null;
  }
}

/** Every target's README passages. Failures and missing READMEs contribute nothing. */
export async function loadReadmeDocs(targets: ReadmeTarget[]): Promise<KnowledgeDoc[]> {
  const unique = [...new Map(targets.map((target) => [target.slug.toLowerCase(), target])).values()];
  const results = await Promise.all(
    unique.map(async (target) => {
      const markdown = await fetchReadme(target.slug);
      return markdown ? readmeDocs(target, markdown) : [];
    }),
  );
  return results.flat();
}

/** "https://github.com/owner/name" → "owner/name", or null for anything else. */
export function githubSlug(url: string | undefined): string | null {
  const match = url ? /^https:\/\/github\.com\/([\w.-]+\/[\w.-]+?)(?:\.git)?\/?$/.exec(url) : null;
  return match ? match[1] : null;
}
