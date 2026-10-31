import Link from "next/link";
import { Section } from "@/components/layout/Section";
import { buildKnowledge } from "@/lib/ask/knowledge";
import { getSuggestionGroups } from "@/lib/ask/suggestions";
import { reveal } from "@/lib/reveal";
import { AskConsole } from "./AskConsole";

/** What the guide is, said plainly beside it. Each line is a property of the code, not a promise. */
const GROUND_RULES = [
  "It is an AI guide to this portfolio — not Omjee.",
  "Every answer cites the pages it was built from.",
  "When something isn't documented, it says so.",
  "Nothing is stored: the conversation lives only in this tab.",
];

/** The same destinations the guide points to, for visitors without JavaScript. */
const DIRECT_ROUTES = [
  { label: "Work", href: "/#work" },
  { label: "Research", href: "/#research" },
  { label: "Experience", href: "/#experience" },
  { label: "Garage", href: "/#garage" },
];

/**
 * Ask Omjee — the third sector, straight after Capabilities: once a visitor knows what he
 * works with, they can question the work itself before reading it. It is a second way into
 * the content, never the only one.
 */
export async function Ask() {
  // The readout counts the passages the guide can actually cite — the same index it answers from.
  const passages = (await buildKnowledge()).length;

  return (
    <Section
      id="ask"
      label="Briefing system"
      title={
        <>
          Ask Omjee.
          <span className="mt-4 block max-w-[34rem] text-[clamp(1.125rem,1.5vw,1.375rem)] font-normal leading-snug tracking-[-0.012em] text-steel">
            Explore the engineer behind the work.
          </span>
        </>
      }
      readout={`${String(passages).padStart(2, "0")} passages indexed`}
      tone="teal"
      layout="wide"
    >
      <div className="grid gap-x-10 gap-y-8 lg:grid-cols-12">
        {/* Sticky on wide screens: the ground rules stay beside a brief however long it runs. */}
        <div className="lg:sticky lg:top-[calc(var(--header-h)+2rem)] lg:col-span-3 lg:self-start" {...reveal("rise")}>
          <p className="label text-champagne">Ground rules</p>
          <ul className="surface mt-4 px-4 py-1">
            {GROUND_RULES.map((rule, index) => (
              <li key={rule} className="grid grid-cols-[2rem_1fr] border-b border-rule py-3 text-[0.9375rem] leading-snug text-steel last:border-b-0">
                <span aria-hidden="true" className="readout pt-px text-[0.6875rem] text-faint">
                  {String(index + 1).padStart(2, "0")}
                </span>
                {rule}
              </li>
            ))}
          </ul>
        </div>

        <div className="lg:col-span-9" {...reveal("settle", 1)}>
          <AskConsole groups={getSuggestionGroups()} />
          <noscript>
            <p className="mt-4 text-[0.9375rem] leading-relaxed text-steel">
              The guide needs JavaScript. Everything it draws on is on this page:{" "}
              {DIRECT_ROUTES.map((route, index) => (
                <span key={route.href}>
                  {index > 0 && ", "}
                  <Link href={route.href} className="text-bone underline underline-offset-4">
                    {route.label}
                  </Link>
                </span>
              ))}
              .
            </p>
          </noscript>
        </div>
      </div>
    </Section>
  );
}
