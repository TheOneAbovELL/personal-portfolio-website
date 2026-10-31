import { SectorLabel, SectorLine } from "@/components/layout/Section";
import { Icon } from "@/components/ui/Icon";
import { profile } from "@/content";
import { reveal } from "@/lib/reveal";

/** The end of the lap: the visual system resolves into one warm light and one action. */
export function Contact() {
  const links = [
    { label: "Résumé", detail: "PDF", href: profile.resume.href },
    ...profile.socials
      .filter((social) => ["linkedin", "github", "instagram"].includes(social.id))
      .map((social) => ({ label: social.label, detail: social.handle, href: social.href })),
  ];

  return (
    <section id="contact" aria-labelledby="contact-title" className="section" data-race-zone="contact" data-tone="red">
      <div className="shell pb-[clamp(5rem,10vw,8rem)] pt-[clamp(4.5rem,9vw,8.5rem)]">
        <SectorLine tone="red" />
        <SectorLabel id="contact" label="Contact" readout={profile.availability.open ? profile.availability.label : "Channel open"} />

        <h2
          id="contact-title"
          className="display mt-[clamp(3rem,7vw,6rem)] text-[clamp(3rem,8vw,8rem)] tracking-[-0.05em]"
          data-reveal="mask"
          data-drift=""
          style={{ "--drift": "3rem" } as React.CSSProperties}
        >
          <span className="mask">
            Let&rsquo;s build
            <br />
            something<span className="text-rosso">.</span>
          </span>
        </h2>

        <div className="mt-[clamp(3rem,6vw,5rem)] grid gap-x-16 gap-y-12 lg:grid-cols-12">
          <div className="lg:col-span-7" {...reveal("rise")}>
            <p className="label flex items-center gap-2.5 text-steel">
              <span aria-hidden="true" className="pulse-dot size-1.5 rounded-full bg-rosso-bright" />
              Direct line
            </p>
            <a
              href={`mailto:${profile.email}`}
              className="group mt-4 inline-flex max-w-full items-center gap-3 text-[clamp(1.25rem,2.8vw,2.25rem)] font-medium tracking-[-0.03em] text-bone transition-colors duration-[var(--dur-base)] hover:text-rosso-bright"
            >
              <span className="link-underline truncate pb-1">{profile.email}</span>
              <Icon
                name="arrow-up-right"
                size={22}
                className="shrink-0 transition-transform duration-[320ms] ease-[var(--ease-out)] group-hover:-translate-y-1 group-hover:translate-x-1"
              />
            </a>
            <p className="prose-body measure mt-6 text-steel">{profile.availability.note}</p>
          </div>

          <nav aria-label="Elsewhere" className="lg:col-span-4 lg:col-start-9" {...reveal("settle", 1)}>
            <ul className="surface overflow-hidden rounded-lg p-1.5" data-float="">
              {links.map((link) => (
                <li key={link.label}>
                  <a
                    href={link.href}
                    target="_blank"
                    rel="noopener noreferrer"
                    className="group flex min-h-14 items-center justify-between gap-6 rounded-md px-4 text-bone transition-colors duration-[var(--dur-base)] hover:bg-bone/[0.05]"
                  >
                    <span className="text-[1rem] font-medium">{link.label}</span>
                    <span className="flex items-center gap-3">
                      <span className="label text-faint transition-colors duration-[var(--dur-base)] group-hover:text-steel">{link.detail}</span>
                      <Icon
                        name="arrow-up-right"
                        size={14}
                        className="text-faint transition-[transform,color] duration-[320ms] ease-[var(--ease-out)] group-hover:-translate-y-0.5 group-hover:translate-x-0.5 group-hover:text-rosso-bright"
                      />
                    </span>
                  </a>
                </li>
              ))}
            </ul>
          </nav>
        </div>
      </div>
    </section>
  );
}
