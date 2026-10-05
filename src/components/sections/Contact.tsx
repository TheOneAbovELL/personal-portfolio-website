import { SectorLabel, SectorLine } from "@/components/layout/Section";
import { ButtonLink } from "@/components/ui/Button";
import { Icon } from "@/components/ui/Icon";
import { profile } from "@/content";
import { reveal } from "@/lib/reveal";

/** The end of the lap: the visual system resolves into one warm light and one action. */
export function Contact() {
  return (
    <section id="contact" aria-labelledby="contact-title" className="section" data-race-zone="contact" data-tone="red">
      <div className="shell pb-[clamp(4rem,8vw,7rem)] pt-[clamp(4.5rem,9vw,8.5rem)]">
        <SectorLine tone="red" />
        <SectorLabel id="contact" label="Contact" readout="Channel open" />
        <div className="kerb mt-4 w-20" aria-hidden="true" {...reveal("trace")} />

        <h2
          id="contact-title"
          className="display mt-[clamp(2rem,5vw,4rem)] text-[clamp(2.75rem,9.4vw,9rem)] uppercase"
          {...reveal("mask")}
        >
          <span className="mask">
            Let&rsquo;s build
            <br />
            something<span className="text-perf">.</span>
          </span>
        </h2>

        <div className="mt-[clamp(2.5rem,5vw,4rem)] grid gap-x-10 gap-y-10 lg:grid-cols-12">
          <p className="prose-body text-steel lg:col-span-5" {...reveal("rise")}>
            {profile.availability.note}
          </p>

          <div className="lg:col-span-7" {...reveal("rise", 1)}>
            <p className="label flex items-center gap-2.5 text-steel">
              <span aria-hidden="true" className="pulse-dot size-1.5 rounded-full bg-perf" />
              Direct line
            </p>
            <a
              href={`mailto:${profile.email}`}
              className="group mt-3 inline-flex max-w-full items-center gap-3 border-b border-rule-strong pb-2 text-[clamp(1.25rem,3.4vw,2.25rem)] font-medium text-bone transition-colors duration-[var(--dur-fast)] hover:border-signal hover:text-signal"
            >
              <span className="truncate">{profile.email}</span>
              <Icon
                name="arrow-up-right"
                size={24}
                className="shrink-0 transition-transform duration-[220ms] ease-[var(--ease-snap)] group-hover:-translate-y-1 group-hover:translate-x-1"
              />
            </a>

            <div className="mt-8 flex flex-wrap gap-3">
              <ButtonLink href={profile.resume.href} icon="arrow-up-right">
                Résumé
              </ButtonLink>
              {profile.socials
                .filter((social) => social.id === "linkedin" || social.id === "github")
                .map((social) => (
                  <ButtonLink key={social.id} href={social.href} variant="secondary" icon="arrow-up-right">
                    {social.label}
                  </ButtonLink>
                ))}
            </div>
          </div>
        </div>
      </div>
    </section>
  );
}
