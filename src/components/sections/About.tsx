import { Section } from "@/components/layout/Section";
import { profile } from "@/content";
import { reveal } from "@/lib/reveal";

export function About() {
  const { about, layers, principles, loop } = profile;

  return (
    <Section id="about" label="Engineering philosophy" title={about.lead} readout="Operating principle" tone="teal">
      <div className="grid gap-x-10 gap-y-6 md:grid-cols-2">
        {about.paragraphs.map((paragraph, index) => (
          <p key={index} className="prose-body text-steel" {...reveal("rise", index)}>
            {paragraph}
          </p>
        ))}
      </div>

      {/* The working loop, as a single quiet line. It returns in the footer as a sign-off. */}
      <p className="label mt-10 flex flex-wrap items-center gap-x-3 gap-y-2 text-steel" {...reveal("snap")}>
        {loop.map((step, index) => (
          <span key={step} className="flex items-center gap-3">
            {index > 0 && (
              <span aria-hidden="true" className="text-signal">
                →
              </span>
            )}
            {step}
          </span>
        ))}
      </p>

      {/* The path a system takes from raw data to something people use — data flows in cyan. */}
      <div className="mt-[clamp(3rem,6vw,5rem)]">
        <p className="label text-faint" {...reveal("snap")}>
          Where I work — the whole path
        </p>
        <div className="mt-5 hidden h-px bg-gradient-to-r from-data via-data/40 to-signal sm:block" aria-hidden="true" {...reveal("trace")} />
        <ol className="grid border-t border-rule sm:grid-cols-5 sm:border-t-0">
          {layers.map((layer, index) => (
            <li key={layer.label} className="relative border-b border-rule py-4 sm:border-b-0 sm:pr-5 sm:pt-5" {...reveal("rise", index)}>
              <span
                aria-hidden="true"
                className={`absolute -top-[3px] left-0 hidden size-[5px] rounded-full sm:block ${
                  index === layers.length - 1 ? "bg-signal" : "bg-data"
                }`}
              />
              <span className="flex items-baseline gap-3 sm:block">
                <span className="label text-faint">{String(index + 1).padStart(2, "0")}</span>
                <span className="display block text-[1.125rem] sm:mt-2">{layer.label}</span>
              </span>
              <span className="mt-1.5 block text-[0.875rem] leading-snug text-steel sm:mt-2">{layer.note}</span>
            </li>
          ))}
        </ol>
      </div>

      <dl className="mt-[clamp(3rem,6vw,5rem)] grid gap-x-10 gap-y-8 md:grid-cols-3">
        {principles.map((principle, index) => (
          <div key={principle.title} className="border-t border-rule-strong pt-4" {...reveal("rise", index)}>
            <dt className="label text-bone">
              <span className="text-signal">{String.fromCharCode(65 + index)}</span>
              <span aria-hidden="true" className="mx-2 text-metal-3">
                /
              </span>
              {principle.title}
            </dt>
            <dd className="mt-3 text-[0.9375rem] leading-relaxed text-steel">{principle.detail}</dd>
          </div>
        ))}
      </dl>
    </Section>
  );
}
