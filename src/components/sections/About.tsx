import { Section } from "@/components/layout/Section";
import { profile } from "@/content";
import { reveal } from "@/lib/reveal";

export function About() {
  const { about, layers, principles, loop } = profile;

  return (
    <Section id="about" label="Engineering philosophy" title={about.lead} readout="Operating principle" tone="teal">
      <div className="grid gap-x-12 gap-y-6 md:grid-cols-2">
        {about.paragraphs.map((paragraph, index) => (
          <p key={index} className="prose-body text-steel" {...reveal("rise", index)}>
            {paragraph}
          </p>
        ))}
      </div>

      {/* The working loop, as a single quiet line that switches on step by step. It returns in the
          footer as a sign-off. */}
      <p className="label mt-12 flex flex-wrap items-center gap-x-3 gap-y-2 text-steel">
        {loop.map((step, index) => (
          <span key={step} className="flex items-center gap-3" {...reveal("snap", index * 1.6 + 2)}>
            {index > 0 && (
              <span aria-hidden="true" className="text-champagne/70">
                →
              </span>
            )}
            {step}
          </span>
        ))}
      </p>

      {/* The path a system takes from raw data to something people use. The line draws first,
          then each stage arrives in order; a light keeps travelling along it — data in flow. */}
      <div className="mt-[clamp(3.5rem,7vw,6rem)]">
        <p className="label text-faint" {...reveal("snap")}>
          Where I work — the whole path
        </p>
        <div className="relative mt-6 hidden h-px overflow-hidden sm:block" aria-hidden="true">
          <div className="absolute inset-0 bg-gradient-to-r from-bone/30 via-bone/15 to-rosso/80" {...reveal("trace")} />
          <span className="flow-light absolute inset-y-0 left-0 w-1/4 bg-gradient-to-r from-transparent via-champagne to-transparent opacity-80" />
        </div>
        <ol className="grid sm:grid-cols-5">
          {layers.map((layer, index) => (
            <li
              key={layer.label}
              className="relative border-b border-rule/60 py-4 last:border-b-0 sm:border-b-0 sm:pr-6 sm:pt-6"
              {...reveal("rise", index * 3 + 2)}
            >
              <span
                aria-hidden="true"
                className={`absolute -top-[3px] left-0 hidden size-[7px] rounded-full ring-4 ring-carbon/60 sm:block ${
                  index === layers.length - 1 ? "bg-rosso-bright" : "bg-bone/70"
                }`}
              />
              <span className="flex items-baseline gap-3 sm:block">
                <span className="label text-faint">{String(index + 1).padStart(2, "0")}</span>
                <span className="block text-[1.0625rem] font-medium tracking-[-0.015em] text-bone sm:mt-2">{layer.label}</span>
              </span>
              <span className="mt-1.5 block text-[0.875rem] leading-relaxed text-steel sm:mt-2">{layer.note}</span>
            </li>
          ))}
        </ol>
      </div>

      <dl className="mt-[clamp(3.5rem,7vw,6rem)] grid gap-3 md:grid-cols-3">
        {principles.map((principle, index) => (
          <div key={principle.title} className="surface rounded-lg p-6" {...reveal("rise", index)}>
            <dt className="label text-bone">
              <span className="text-champagne">{String.fromCharCode(65 + index)}</span>
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
