/**
 * Text utilities shared by retrieval and answer composition: normalisation, a light stemmer,
 * a small synonym map and helpers for assembling plain-text answers.
 */

const STOPWORDS = new Set(
  (
    "a an the and or but if so of to in on at by for from with without into onto over under about as than then " +
    "is are was were be been being am do does did doing done has have had having can could would should will shall may might must " +
    "i me my mine we us our you your yours it its this that these those there here them they their " +
    "what which who whom whose when where how why whats " +
    "not no nor isn aren wasn don doesn didn hasn haven won " +
    "any some all each every both either more most much many few lot lots such own same other " +
    "just also too very really quite please kindly thanks thank tell show give say know get got let " +
    "use used using uses " +
    // The portfolio's subject carries no retrieval signal: every document is about him.
    "omjee giri he his him himself"
  ).split(" "),
);

/** Plural-looking words the stemmer must leave alone. */
const STEM_EXCEPTIONS = new Set(["news", "series", "analysis", "always", "sse", "faiss", "pandas", "kubernetes"]);

/**
 * Words that should match each other. Kept deliberately small: every group is something a
 * visitor is likely to say differently from how the content says it.
 */
const SYNONYM_GROUPS: string[][] = [
  ["rag", "retrieval", "retrieve", "retriever"],
  ["cp", "codeforces", "competitive", "contest"],
  ["quant", "quantitative", "finance", "financial"],
  ["eeg", "qeeg", "electroencephalography"],
  ["tech", "technology", "stack", "tool", "framework", "library"],
  ["education", "degree", "university", "college", "institute", "btech", "academic"],
  ["job", "role", "internship", "intern", "position", "opportunity"],
  ["repo", "repository", "github"],
  ["resume", "cv"],
  ["contact", "email", "mail", "reach"],
  ["architecture", "architected", "architect", "design", "structure", "component"],
  ["limitation", "limit", "gap", "weakness", "drawback", "shortcoming", "caveat"],
  ["test", "reliability", "reliable", "robust"],
  ["law", "legal", "statute", "judiciary"],
  ["option", "derivative"],
  ["recommendation", "recommender", "recommend"],
  ["satellite", "geospatial", "imagery"],
  ["build", "built", "make", "made", "create", "develop"],
  ["learn", "lesson", "takeaway"],
  ["next", "future", "roadmap", "plan", "upcoming"],
  ["decision", "decide", "choice", "choose", "tradeoff", "rationale"],
  ["metric", "measure", "evaluation", "evaluate", "benchmark"],
  ["agent", "agentic"],
  ["graph", "gnn", "gcn"],
  ["backend", "api", "server"],
  ["experience", "background", "career"],
  ["achievement", "award", "recognition", "rank", "rating"],
  ["philosophy", "principle", "value", "mindset"],
  ["interest", "explore", "focus"],
];

/** Multi-word phrases that imply a single index term. Applied to documents and questions. */
const PHRASE_ALIASES: [RegExp, string][] = [
  [/\bcompetitive programming\b/, "codeforces"],
  [/\bmachine learning\b/, "ml"],
  [/\bartificial intelligence\b/, "ai"],
  [/\blanguage models?\b/, "llm"],
  [/\bget in touch\b/, "contact"],
  [/\bside projects?\b/, "repository"],
  [/\bretrieval augmented generation\b/, "rag"],
  [/\bdata structures?\b/, "dsa"],
];

/** Unicode combining marks (U+0300 to U+036F), left behind when NFKD splits an accented letter. */
const COMBINING_MARKS = new RegExp(`[${String.fromCharCode(0x300)}-${String.fromCharCode(0x36f)}]`, "g");

/** Lowercase, strip accents and punctuation, and keep a few symbols that carry meaning. */
export function normalize(text: string): string {
  return text
    .toLowerCase()
    .normalize("NFKD")
    .replace(COMBINING_MARKS, "")
    .replace(/c\+\+/g, "cpp")
    .replace(/c#/g, "csharp")
    .replace(/\bb\.\s?tech\b/g, "btech")
    .replace(/[^a-z0-9]+/g, " ")
    .trim();
}

function undouble(word: string): string {
  const last = word[word.length - 1];
  return word.length > 3 && last === word[word.length - 2] && !"aeioulsz".includes(last) ? word.slice(0, -1) : word;
}

/**
 * A deliberately small suffix stripper. It only needs to be consistent between documents and
 * questions ("architectures" and "architecture" must collide), not linguistically correct.
 */
export function stem(word: string): string {
  if (word.length <= 3 || /\d/.test(word) || STEM_EXCEPTIONS.has(word)) return word;
  let stemmed = word;
  if (stemmed.endsWith("ies") && stemmed.length > 4) stemmed = `${stemmed.slice(0, -3)}y`;
  else if (stemmed.endsWith("sses")) stemmed = stemmed.slice(0, -2);
  else if (stemmed.endsWith("s") && !/(ss|us|is)$/.test(stemmed)) stemmed = stemmed.slice(0, -1);

  if (stemmed.length > 5 && stemmed.endsWith("ing")) stemmed = undouble(stemmed.slice(0, -3));
  else if (stemmed.length > 4 && stemmed.endsWith("ed")) stemmed = undouble(stemmed.slice(0, -2));

  if (stemmed.length > 4 && stemmed.endsWith("e")) stemmed = stemmed.slice(0, -1);
  return stemmed;
}

const SYNONYMS: Map<string, string[]> = (() => {
  const map = new Map<string, Set<string>>();
  for (const group of SYNONYM_GROUPS) {
    const stems = [...new Set(group.map(stem))];
    for (const term of stems) {
      const bucket = map.get(term) ?? new Set<string>();
      for (const other of stems) if (other !== term) bucket.add(other);
      map.set(term, bucket);
    }
  }
  return new Map([...map].map(([term, bucket]) => [term, [...bucket]]));
})();

/** Stemmed synonyms of a stemmed term. */
export const synonymsOf = (term: string): string[] => SYNONYMS.get(term) ?? [];

function withPhraseAliases(normalized: string): string {
  let expanded = normalized;
  for (const [pattern, alias] of PHRASE_ALIASES) if (pattern.test(normalized)) expanded += ` ${alias}`;
  return expanded;
}

const isToken = (token: string) => token.length > 1 || /\d/.test(token);

/** Every token, stemmed, stopwords included — used for phrase matching. */
export function stemTokens(text: string): string[] {
  return normalize(text).split(" ").filter(isToken).map(stem);
}

/** Content terms: stopwords removed, stemmed, phrase aliases added. */
export function terms(text: string): string[] {
  return withPhraseAliases(normalize(text))
    .split(" ")
    .filter((token) => isToken(token) && !STOPWORDS.has(token))
    .map(stem);
}

/** True when the text contains every wanted term, directly or through a synonym. */
export function mentions(text: string, wanted: readonly string[]): boolean {
  const present = new Set(terms(text));
  return wanted.length > 0 && wanted.every((term) => present.has(term) || synonymsOf(term).some((synonym) => present.has(synonym)));
}

/** Split prose into sentences without breaking inside a quotation. */
export function splitSentences(text: string): string[] {
  const sentences: string[] = [];
  let current = "";
  let inQuote = false;
  for (let index = 0; index < text.length; index += 1) {
    const char = text[index];
    current += char;
    if (char === '"' || char === "“" || char === "”") inQuote = char === "“" ? true : char === "”" ? false : !inQuote;
    const next = text[index + 1];
    const afterNext = text[index + 2];
    const endsSentence = ".!?".includes(char) && !inQuote && next === " " && afterNext !== undefined && /[A-Z0-9"“(]/.test(afterNext);
    if (endsSentence || char === "\n") {
      if (current.trim()) sentences.push(current.trim());
      current = "";
    }
  }
  if (current.trim()) sentences.push(current.trim());
  return sentences;
}

export const wordCount = (text: string): number => text.split(/\s+/).filter(Boolean).length;

/** "a", "a and b", "a, b and c". */
export function joinList(items: readonly string[]): string {
  if (items.length <= 1) return items[0] ?? "";
  return `${items.slice(0, -1).join(", ")} and ${items[items.length - 1]}`;
}

/** Lowercase the first letter unless the word looks like an acronym or a proper name token. */
export function lowerFirst(text: string): string {
  const second = text[1];
  if (!text || (second && second === second.toUpperCase() && /[A-Z]/.test(second))) return text;
  return text[0].toLowerCase() + text.slice(1);
}

export const stripTrailingPeriod = (text: string): string => text.replace(/[.\s]+$/, "");

export const ensurePeriod = (text: string): string => (/[.!?…"”)]$/.test(text.trim()) ? text.trim() : `${text.trim()}.`);

/**
 * Keep leading parts until a word budget is reached. The first part is always kept, so an
 * answer is never empty.
 */
export function fitToBudget(parts: readonly string[], budget: number): { kept: string[]; truncated: boolean } {
  const kept: string[] = [];
  let used = 0;
  for (const part of parts) {
    const words = wordCount(part);
    if (kept.length > 0 && used + words > budget) return { kept, truncated: true };
    kept.push(part);
    used += words;
  }
  return { kept, truncated: false };
}

/** Cut text at the last sentence boundary before `maxChars`. */
export function clampAtSentence(text: string, maxChars: number): string {
  if (text.length <= maxChars) return text;
  const slice = text.slice(0, maxChars);
  const boundary = Math.max(slice.lastIndexOf(". "), slice.lastIndexOf("? "), slice.lastIndexOf("! "), slice.lastIndexOf(".\n"));
  return boundary > maxChars * 0.5 ? slice.slice(0, boundary + 1).trim() : `${slice.trim()}…`;
}
