import Link from "next/link";
import { Section } from "@/components/layout/Section";
import { skills } from "@/content";
import { reveal } from "@/lib/reveal";
import { CapabilityConsole } from "./CapabilityConsole";

/**
 * Capabilities, always tied to evidence. Wide screens get the interactive console; smaller
 * screens (and no-JavaScript visitors on them) get the same content as a plain sheet.
 */
export function Capabilities() {
  return (
    <Section
      id="capabilities"
      label="Capabilities"
      title="What I work with — and the work that proves it."
      readout={`${String(skills.length).padStart(2, "0")} domains`}
      tone="teal"
      layout="wide"
    >
      <div className="hidden lg:block" {...reveal("settle")}>
        <CapabilityConsole domains={skills} />
        <p className="label mt-4 text-faint">Select a domain to see where it has been used.</p>
      </div>

      <ul className="lg:hidden">
        {skills.map((domain, index) => (
          <li key={domain.id} className="border-b border-rule py-7 first:border-t" {...reveal("rise", index % 3)}>
            <h3 className="display flex items-baseline gap-3 text-[1.375rem]">
              <span className="label text-signal">{String(index + 1).padStart(2, "0")}</span>
              {domain.title}
            </h3>
            <p className="mt-2 text-[0.9375rem] text-steel">{domain.summary}</p>

            <ul className="mt-4 flex flex-wrap gap-x-2 gap-y-1.5" aria-label={`${domain.title}: tools and concepts`}>
              {domain.items.map((item, itemIndex) => (
                <li key={item} className="flex items-center gap-2 text-[1rem] text-bone">
                  {item}
                  {itemIndex < domain.items.length - 1 && (
                    <span aria-hidden="true" className="text-metal-3">
                      /
                    </span>
                  )}
                </li>
              ))}
            </ul>

            <ul className="mt-5 space-y-3 border-l border-signal/50 pl-4" aria-label={`${domain.title}: evidence`}>
              {domain.evidence.map((item) => (
                <li key={item.source} className="text-[0.9375rem] leading-snug">
                  {item.href ? (
                    <Link href={item.href} className="link-underline font-medium text-bone hover:text-signal">
                      {item.source}
                    </Link>
                  ) : (
                    <span className="font-medium text-bone">{item.source}</span>
                  )}
                  <span className="mt-0.5 block text-steel">{item.note}</span>
                </li>
              ))}
            </ul>
          </li>
        ))}
      </ul>
    </Section>
  );
}
