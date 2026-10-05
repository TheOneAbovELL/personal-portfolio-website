/**
 * Intent rules: recognise the common, simple questions that can be answered straight from
 * the content without a model call.
 *
 * The rules are intentionally conservative. A cue word alone is not enough — the question
 * must also be "simple", meaning that once the cue, the named project and filler words are
 * removed, at most one content word is left. "How is Legal Lens architected?" qualifies;
 * "How does the Legal Lens evidence gate decide what to reject?" does not and goes to retrieval.
 */

import { experience, skills, visibleProjects } from "@/content";
import type { ExperienceKind } from "@/content";
import type { GarageCategory } from "@/content/garage";

import type { Entity, KnowledgeBase } from "./knowledge";
import { isKnownTerm } from "./retrieve";
import type { Focus } from "./retrieve";
import type { ProjectAspect } from "./suggestions";
import { normalize, stem, synonymsOf, terms, wordCount } from "./text";

type SimpleIntent =
  | "offtopic"
  | "greeting"
  | "thanks"
  | "identity"
  | "about"
  | "philosophy"
  | "projects"
  | "skills"
  | "education"
  | "contact"
  | "contact-unlisted"
  | "resume"
  | "availability"
  | "research"
  | "achievements"
  | "none";

export type Intent =
  | { kind: SimpleIntent }
  /** `roleId` is set when the question singles out one role ("his open-source work"). */
  | { kind: "experience"; roleId: string | null }
  | { kind: "garage"; language: string | null; category: GarageCategory | null; onlySmall: boolean }
  | { kind: "tech"; technologies: Entity[] }
  | { kind: "tech-unknown"; name: string }
  | { kind: "skill-domain"; domainId: string }
  | {
      kind: "project";
      slug: string;
      aspect: ProjectAspect | "more";
      /** A technology the question asks about within this project ("Does it use Docker?"). */
      technology: Entity | null;
      /**
       * Content words that narrow the lookup: the fact a "how many" question asks for, or the
       * particular decision a "why" question is about. Empty means "the whole block".
       */
      keyTerms: string[];
    }
  | { kind: "repo"; name: string };

const NONE: Intent = { kind: "none" };

/* ----------------------------------------------------------------------- cues */

const REFERS_TO_PERSON = /\b(omjee|giri|he|his|him|he's)\b/;

const INJECTION =
  /\b(ignore|disregard|forget|override)\b[\w\s]{0,30}\b(instructions?|rules?|prompts?|guidelines?)\b|\bsystem prompt\b|\bjailbreak\b|\bact as\b|\bpretend (to be|you)\b|\byou are now\b|\bdeveloper mode\b/;
const GENERATIVE =
  /^(?:(?:please|pls|can you|could you|would you|hey|ok|okay)[\s,]+)*(?:write|generate|code|implement|debug|fix|translate|solve|compose|draft|calculate|compute)\b/;
const CHITCHAT = /\b(joke|poem|weather|recipe|story|song|lyrics|riddle|horoscope)\b/;
const GREETING = /^(hi|hello|hey|yo|hola|namaste|greetings|good (morning|afternoon|evening))\b[\s!.,]*(there|omjee)?[\s!.,]*$/;
const THANKS = /^(thanks|thank you|thx|ty|cheers|great|nice|cool|awesome|ok|okay|got it)\b[\s!.,\w]{0,24}$/;
const IDENTITY =
  /\b(who|what) are you\b|\bare you (omjee|a|an|the|chatgpt|claude|gpt|real|human)\b|\byour name\b|\bwhat can (you|i) (do|answer|help|ask)\b|\bhow do you work\b|\bwhich (model|llm)\b|\bis this (omjee|an? (ai|bot))\b/;

/** Questions that need reasoning across the content rather than a lookup. */
const ANALYTICAL =
  /\b(why|compar\w*|versus|vs|differen\w*|should|instead|rather than|pros|cons)\b|\b(best|better|worst|favou?rite|hardest|proudest)\b.{0,20}\b(project|work|one|part)\b/;

/** "Why …?" about a project is answered from the design decisions recorded in its case study. */
const RATIONALE = /\b(why|rationale|reason(s|ing)?|justif\w*|decisions?|decided|trade-?offs?|choices?|chose|chosen|choose|pick(ed)?|opted)\b/;
/** Words that point at the design as a whole rather than at one particular decision. */
const DESIGN = /\b(architect\w*|design\w*|approach\w*|structur\w*|way|like (this|that)|shaped?|behind|technical|engineering|taken)\b/;
const EXISTENCE = /\b(build|built|made|make|created?|exists?|needed|started?|matters?)\b/;

const OVERVIEW =
  /\b(what is|what's|whats|what are|what was|explain|tell me|describe|about|overview|summar\w+|introduc\w+|walk me through|details? (on|of|about))\b/;
const MORE = /\b(more|elaborate|go on|continue|further|deeper|expand)\b/;

const STACK = /\b(tech|technolog\w+|stack|tools?|languages?|frameworks?|librar\w+|built with|written in|made with|dependenc\w+)\b/;
const LINKS = /\b(repo\w*|github|source|code|demo|links?|url|open[- ]source|public)\b/;
const QUANTITY = /\bhow (many|much)\b/;

const ASPECTS: { aspect: ProjectAspect; cue: RegExp }[] = [
  {
    aspect: "metrics",
    cue: /\b(accura\w*|f1|precision|recall|auc|scores?|results?|performance|benchmarks?|metrics?|numbers?|latency|users?|customers?|revenue|downloads?|how (many|much|fast|accurate|well|good))\b/,
  },
  { aspect: "stack", cue: STACK },
  {
    aspect: "architecture",
    cue: /\b(architect\w*|design(ed)?|structur\w*|components?|pipeline|under the hood)\b|\bhow\b.*\b(works?|built|organi[sz]ed|implemented|put together)\b/,
  },
  { aspect: "limitations", cue: /\b(limit\w*|gaps?|weakness\w*|shortcoming\w*|caveats?|drawbacks?|downsides?|missing|lacks?)\b/ },
  { aspect: "next", cue: /\b(next|roadmap|future|plans?|planned|upcoming)\b/ },
  { aspect: "learnings", cue: /\b(learn\w*|lessons?|takeaways?|taught)\b/ },
  { aspect: "reliability", cue: /\b(reliab\w*|test\w*|fail\w*|fallbacks?|robust\w*|resilien\w*|errors?)\b/ },
  { aspect: "problem", cue: /\b(problems?|motivat\w*|purpose|goals?|aims?|solv\w*|use case)\b/ },
  { aspect: "outcome", cue: /\b(outcome|status|state|progress|finished|complete\w*|done|ready|stage|deployed|production|live)\b/ },
  { aspect: "links", cue: LINKS },
  { aspect: "approach", cue: /\b(approach|method\w*)\b/ },
];

const HANDLE = /\b(github|leetcode|codeforces|linkedin)\b.{0,12}\b(profile|handle|username|account|link|url|id)\b/;
/** Contact details the portfolio deliberately does not publish. */
const UNLISTED_CONTACT = /\b(phone|telephone|whats ?app)\b|\b(mobile|cell|contact) (number|no)\b|\bcall (him|omjee)\b/;
const CONTACT = /\b(contact\w*|e-?mail|reach|get in touch|linkedin|socials?|social media|connect with|message him|dm)\b/;
const RESUME = /\b(resume|résumé|cv|curriculum vitae)\b/;
const AVAILABILITY =
  /\b(availab\w*|hir(e|ing)|looking for|open to|seeking|recruit\w*|opportunit\w*)\b|\b(roles?|jobs?|internships?|positions?)\b.*\b(look\w*|want\w*|seek\w*|interested|open|target\w*)\b|\b(look\w*|want\w*|seek\w*)\b.*\b(roles?|jobs?|internships?|positions?)\b/;
const EDUCATION =
  /\b(educat\w*|stud(y|ies|ying|ied)|degrees?|college|universit\w*|b\.?\s?tech|btech|iit|bit mesra|school|major|graduat\w*|student|academic\w*|qualification\w*)\b/;
const ACHIEVEMENTS =
  /\b(codeforces|competitive programming|cp|rating|rated|leetcode|achievements?|awards?|recognition|rank(ed|ing)?|contests?|accomplishments?)\b/;
const PROJECTS = /\b(projects?|case stud(y|ies)|featured|flagship|portfolio|built|build|made|shipped|worked on|his work)\b/;
const SKILLS =
  /\b(tech|technolog(y|ies)|stack|skills?|tools?|languages?|frameworks?|librar(y|ies)|capabilit\w*|expertise|toolkit|good at|best at|strengths?|speciali[sz]\w*)\b/;
const EXPERIENCE =
  /\b(experience|background|career|employ\w*|gssoc|girlscript|open[- ]source|contribut\w*|research assistant|nyay setu|pull requests?|prs|worked (at|for)|work history|internships?|jobs?|positions?|roles?)\b/;
const RESEARCH =
  /\b(research\w*|currently|right now|these days|nowadays|working on|explor\w+|interests?|interested in|focus\w*|up to|doing now)\b/;
const PHILOSOPHY =
  /\b(philosoph\w*|principles?|values?|mindset|motto|believ\w*|approach\w*|way of working|work style|what drives|motivat\w*)\b|\bhow does (he|omjee) (work|think|build)\b/;
const ABOUT =
  /\b(who is|who's|whos|about (omjee|him)|introduc\w*|kind of (engineer|developer|person)|what does (he|omjee) do|bio|summar\w+|tell me about)\b/;

/** Asking what Omjee contributed somewhere is about a role, even when a repository is named. */
const CONTRIBUTION = /\b(contribut\w*|pull requests?|prs|gssoc|girlscript|open[- ]source)\b/;

const ROLE_KIND_CUES: Partial<Record<ExperienceKind, RegExp>> = {
  "open-source": /\b(open[- ]source|contribut\w*|pull requests?|prs)\b/,
  research: /\bresearch (assistant|role|position|work)\b/,
  internship: /\binternships?\b/,
  hackathon: /\bhackathons?\b/,
  freelance: /\bfreelanc\w*\b/,
};

const TECH_PROBE =
  /\b(?:knows?|familiar with|experienced? (?:with|in)|worked with|works? with|skills? (?:in|with)|skilled (?:in|at|with)|proficient (?:in|with|at)|good at|uses?|used|using|codes? in|programs? in|expertise in)\b(.*)$/;

const SMALL = /\b(other|small\w*|side|mini|tiny|toy|hobby|additional|lesser|minor|experiments?|else|rest)\b/;
const REPO_WORDS = /\b(garage|repos?|repositor(y|ies)|github)\b/;
const PROJECT_WORDS = /\b(projects?|built|build|made|things|stuff|work)\b/;

const CATEGORY_CUES: [RegExp, GarageCategory][] = [
  [/\b(ai|ml|machine learning|deep learning|nlp)\b/, "AI / ML"],
  [/\b(quant\w*|financ\w+|trading)\b/, "Quant"],
  [/\b(web|websites?|frontend|front-end)\b/, "Web"],
  [/\b(systems?|backend|infrastructure)\b/, "Systems"],
  [/\b(leetcode|dsa|problem[- ]solving|algorithms?)\b/, "Problem solving"],
];

const LANGUAGE_ALIASES: Record<string, string> = { js: "javascript", ts: "typescript", py: "python" };

/** Words that shape a question without narrowing what it asks for. */
const FILLER = new Set(
  (
    "explain describe overview summary summarize summarise brief briefly short quick quickly detail detailed main key major " +
    "exactly actually currently basically generally project system thing stuff work built build made one kind type sort like look " +
    "info information something anything everything else ever yet still now today right new latest recent current portfolio website site " +
    "list name mention talk walk through go bit little high level simple simply plain term word question ask answer want need curious " +
    "wondering hear engineer developer person guy student attend have hold held"
  )
    .split(" ")
    .map(stem),
);

/** Content words left once cues, named entities and filler are removed. */
function residual(lower: string, cues: RegExp[], focus: Focus, extraWords: string[] = []): string[] {
  let text = lower;
  for (const cue of cues) text = text.replace(new RegExp(cue.source, "g"), " ");
  const ignored = new Set([
    ...[...focus.explicit, ...focus.technologies].flatMap((entity) => entity.aliases.flatMap((alias) => alias.split(" "))),
    ...extraWords.map(stem),
  ]);
  return [...new Set(terms(text))].filter((term) => !ignored.has(term) && !FILLER.has(term));
}

/* ------------------------------------------------------------------- subjects */

/**
 * "Why was that architecture chosen?", "What design decisions shaped ARGUS?", "Why did the
 * simpler reranker win?" — all resolve to the project's decisions. Whatever specific words
 * remain become `keyTerms`, which pick out the matching decision; if none matches, the
 * composer declines and the question goes to retrieval.
 */
function classifyRationale(lower: string, focus: Focus, slug: string): Intent | null {
  if (!RATIONALE.test(lower)) return null;
  // Technologies stay in as key terms here: "Why Qdrant?" should look for a decision about it.
  const keyTerms = residual(lower, [RATIONALE, DESIGN, EXISTENCE, OVERVIEW], { ...focus, technologies: [] });
  const asksWhyItExists = keyTerms.length === 0 && /\bwhy\b/.test(lower) && EXISTENCE.test(lower) && !DESIGN.test(lower);
  return { kind: "project", slug, aspect: asksWhyItExists ? "problem" : "decisions", technology: null, keyTerms };
}

function classifyProject(lower: string, focus: Focus, slug: string): Intent | null {
  const technology = focus.technologies[0] ?? null;

  for (const { aspect, cue } of ASPECTS) {
    if (!cue.test(lower)) continue;
    if (aspect === "metrics") {
      const keyTerms = QUANTITY.test(lower) ? residual(lower, [QUANTITY], focus) : [];
      return { kind: "project", slug, aspect, technology: null, keyTerms };
    }
    return residual(lower, [cue, OVERVIEW], focus).length <= 1
      ? { kind: "project", slug, aspect, technology, keyTerms: [] }
      : null;
  }

  if (technology && TECH_PROBE.test(lower) && residual(lower, [TECH_PROBE], focus).length <= 1) {
    return { kind: "project", slug, aspect: "stack", technology, keyTerms: [] };
  }

  // "Is qEEG clinically validated?" — the question echoes the project's own status qualifier.
  const statusNote = visibleProjects().find((project) => project.slug === slug)?.statusNote;
  if (statusNote) {
    const qualifier = new Set(terms(statusNote));
    const asked = residual(lower, [OVERVIEW], focus);
    const echoed = asked.filter((term) => qualifier.has(term));
    if (echoed.length > 0 && asked.length - echoed.length <= 1) {
      return { kind: "project", slug, aspect: "status", technology: null, keyTerms: [] };
    }
  }

  if (focus.carried) {
    return MORE.test(lower) && residual(lower, [MORE, OVERVIEW], focus).length === 0
      ? { kind: "project", slug, aspect: "more", technology: null, keyTerms: [] }
      : null;
  }
  // Naming a technology as well ("How does ARGUS compute the Sharpe ratio?") makes the
  // question specific; an overview would not answer it.
  return technology === null && residual(lower, [OVERVIEW], focus).length <= 1
    ? { kind: "project", slug, aspect: "overview", technology: null, keyTerms: [] }
    : null;
}

function classifyRepo(lower: string, focus: Focus, name: string): Intent | null {
  const cues = [OVERVIEW, MORE, STACK, LINKS];
  if (focus.carried && !cues.some((cue) => cue.test(lower))) return null;
  return residual(lower, cues, focus).length <= 1 ? { kind: "repo", name } : null;
}

/* --------------------------------------------------------------------- global */

function classifyGarage(lower: string, focus: Focus, kb: KnowledgeBase): Intent | null {
  const tokens = new Set(
    normalize(lower)
      .split(" ")
      .map((token) => LANGUAGE_ALIASES[token] ?? token),
  );
  const language =
    [...new Set(kb.repos.map((repo) => repo.language).filter((name): name is string => Boolean(name)))].find((name) =>
      tokens.has(normalize(name)),
    ) ?? null;

  const small = SMALL.test(lower);
  const repoWords = REPO_WORDS.test(lower);
  const projectWords = PROJECT_WORDS.test(lower);
  if (!(repoWords || (small && projectWords) || (language && projectWords))) return null;

  const onlySmall = small || repoWords;
  const category = onlySmall ? (CATEGORY_CUES.find(([cue]) => cue.test(lower))?.[1] ?? null) : null;
  const cues = [SMALL, REPO_WORDS, PROJECT_WORDS, OVERVIEW, ...CATEGORY_CUES.map(([cue]) => cue)];
  const languageWords = language ? [normalize(language), ...Object.keys(LANGUAGE_ALIASES)] : [];
  return residual(lower, cues, focus, languageWords).length <= 1 ? { kind: "garage", language, category, onlySmall } : null;
}

function classifyTechnology(lower: string, focus: Focus, kb: KnowledgeBase): Intent | null {
  const probe = TECH_PROBE.exec(lower);

  if (focus.technologies.length > 0) {
    const leftover = residual(lower, [TECH_PROBE, SKILLS, EXPERIENCE, OVERVIEW], focus);
    // Re-test the probe's tail separately: the cue regex swallows everything after the verb.
    const tail = probe ? residual(probe[1], [OVERVIEW], focus) : [];
    return leftover.length + tail.length <= 1 ? { kind: "tech", technologies: focus.technologies } : null;
  }

  if (!probe) return null;
  const subject = probe[1].replace(/[^a-z0-9 .+#/-]/g, " ").replace(/\s+/g, " ").trim();
  const subjectTerms = residual(subject, [], focus);
  const isUnknown = subjectTerms.length > 0 && subjectTerms.length <= 3 && subjectTerms.every((term) => !isKnownTerm(kb, term));
  return isUnknown && subject.length <= 40 ? { kind: "tech-unknown", name: subject } : null;
}

/** The single role a question points at, by its kind, title, organisation or team name. */
function matchRole(lower: string): string | null {
  const padded = ` ${normalize(lower)} `;
  const matches = experience.filter((role) => {
    const names = [role.organization, role.role, role.unit?.split(" — ")[0] ?? "", ...role.id.split("-").filter((part) => part.length >= 5)]
      .map(normalize)
      .filter((name) => name.length > 3);
    return ROLE_KIND_CUES[role.kind]?.test(lower) || names.some((name) => padded.includes(` ${name} `));
  });
  return matches.length === 1 ? matches[0].id : null;
}

/** The one skill domain whose whole title appears in the question ("AI systems", "quant"). */
function matchDomain(lower: string): string | null {
  const query = new Set(terms(lower));
  const matches = skills.filter((domain) => {
    const title = [...new Set(terms(domain.title))];
    return title.length > 0 && title.every((term) => query.has(term) || synonymsOf(term).some((synonym) => query.has(synonym)));
  });
  return matches.length === 1 ? matches[0].id : null;
}

/**
 * A one- or two-word query is a lookup, not a question: "RAG", "FastAPI", "deepfake", "quant".
 * Exact names are caught earlier by entity detection; this handles domain titles and partial
 * names, and only when exactly one thing matches.
 */
function classifyLookup(lower: string, kb: KnowledgeBase): Intent | null {
  const query = [...new Set(terms(lower))];
  if (query.length === 0 || query.length > 2 || wordCount(lower) > 3) return null;

  const domainId = matchDomain(lower);
  if (domainId) return { kind: "skill-domain", domainId };

  const partial = kb.entities.filter((entity) =>
    query.every((term) => term.length > 2 && entity.aliases.some((alias) => alias.split(" ").includes(term))),
  );
  const named = partial.filter((entity) => entity.kind !== "tech");
  if (named.length === 1) {
    const key = named[0].id.slice(named[0].id.indexOf(":") + 1);
    return named[0].kind === "project"
      ? { kind: "project", slug: key, aspect: "overview", technology: null, keyTerms: [] }
      : { kind: "repo", name: key };
  }
  return named.length === 0 && partial.length > 0 && partial.length <= 2 ? { kind: "tech", technologies: partial } : null;
}

function classifyGlobal(lower: string, focus: Focus, kb: KnowledgeBase): Intent {
  const simple = (...cues: RegExp[]) => residual(lower, [...cues, OVERVIEW], focus).length <= 1;

  if (UNLISTED_CONTACT.test(lower) && simple(UNLISTED_CONTACT, CONTACT)) return { kind: "contact-unlisted" };
  if ((HANDLE.test(lower) || CONTACT.test(lower)) && simple(HANDLE, CONTACT)) return { kind: "contact" };
  if (RESUME.test(lower) && simple(RESUME)) return { kind: "resume" };
  if (AVAILABILITY.test(lower) && simple(AVAILABILITY)) return { kind: "availability" };
  if (EDUCATION.test(lower.replace(/case stud(y|ies)/g, "")) && simple(EDUCATION)) return { kind: "education" };
  if (ACHIEVEMENTS.test(lower) && simple(ACHIEVEMENTS, SKILLS)) return { kind: "achievements" };

  const garage = classifyGarage(lower, focus, kb);
  if (garage) return garage;
  const technology = classifyTechnology(lower, focus, kb);
  if (technology) return technology;

  if (PROJECTS.test(lower) && simple(PROJECTS)) return { kind: "projects" };
  if (SKILLS.test(lower) && simple(SKILLS, TECH_PROBE)) {
    const domainId = matchDomain(lower);
    return domainId ? { kind: "skill-domain", domainId } : { kind: "skills" };
  }
  if (EXPERIENCE.test(lower) && simple(EXPERIENCE)) return { kind: "experience", roleId: matchRole(lower) };
  if (RESEARCH.test(lower) && simple(RESEARCH)) return { kind: "research" };
  if (PHILOSOPHY.test(lower) && simple(PHILOSOPHY)) return { kind: "philosophy" };
  if (ABOUT.test(lower) && simple(ABOUT)) return { kind: "about" };
  if (/\bomjee\b/.test(lower) && residual(lower, [], focus).length === 0) return { kind: "about" };
  return classifyLookup(lower, kb) ?? NONE;
}

export function classifyIntent(question: string, focus: Focus, kb: KnowledgeBase): Intent {
  const lower = question.trim().toLowerCase().replace(/\s+/g, " ");
  const aboutPortfolio = REFERS_TO_PERSON.test(lower) || focus.explicit.length > 0;

  if (INJECTION.test(lower)) return { kind: "offtopic" };
  if (!aboutPortfolio && (GENERATIVE.test(lower) || CHITCHAT.test(lower))) return { kind: "offtopic" };
  if (GREETING.test(lower)) return { kind: "greeting" };
  if (IDENTITY.test(lower)) return { kind: "identity" };
  if (THANKS.test(lower) && wordCount(lower) <= 4 && !lower.includes("?") && !aboutPortfolio) return { kind: "thanks" };

  const tooBroad = wordCount(lower) > 18 || focus.explicit.length > 1;
  if (focus.subject?.kind === "project" && !tooBroad) {
    const rationale = classifyRationale(lower, focus, focus.subject.id.slice("project:".length));
    if (rationale) return rationale;
  }
  if (ANALYTICAL.test(lower) || tooBroad) return NONE;

  const aboutContribution = focus.subject?.kind === "repo" && CONTRIBUTION.test(lower);
  if (focus.subject && !aboutContribution) {
    const [kind, key] = [focus.subject.kind, focus.subject.id.slice(focus.subject.id.indexOf(":") + 1)];
    const scoped = kind === "project" ? classifyProject(lower, focus, key) : classifyRepo(lower, focus, key);
    if (scoped) return scoped;
    // A question that names a project but is not a simple lookup needs retrieval, not a rule.
    if (!focus.carried) return NONE;
  }

  return classifyGlobal(lower, focus, kb);
}
