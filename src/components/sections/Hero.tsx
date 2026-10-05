import Link from "next/link";
import { CarElevation } from "@/components/figures/CarElevation";
import { HeroStage } from "@/components/three/HeroStage";
import { ButtonLink } from "@/components/ui/Button";
import { Icon, type IconName } from "@/components/ui/Icon";
import { featuredProjects, profile, skills } from "@/content";
import { getGarage } from "@/lib/github";

const enter = (index: number) => ({ "--enter-index": index }) as React.CSSProperties;

const SOCIAL_ICON: Partial<Record<string, IconName>> = { github: "github", linkedin: "linkedin" };

/**
 * The hero plays as a short power-up sequence (all CSS, none of it blocks content):
 *   1  system readout switches on, line by line
 *   2  the drawing of the car draws itself; the studio comes up (HeroStage)
 *   3  the name unmasks
 *   4  discipline, statement and actions follow
 *   5  the instrument row — real counts that link into the page — settles last
 */
export async function Hero() {
  const garage = await getGarage();
  const links = [
    ...profile.socials.filter((social) => social.id === "github" || social.id === "linkedin"),
    { id: "email", label: "Email", href: `mailto:${profile.email}` },
  ];

  const system = [
    { key: "System", value: "Online" },
    { key: "Profile", value: profile.name },
  ];

  // Every number here is counted from content and links to the section it describes.
  const instruments = [
    { label: "Domains", value: skills.length, href: "#capabilities" },
    { label: "Systems", value: featuredProjects().length, href: "#work" },
    { label: "Garage", value: garage.repos.length, href: "#garage" },
  ];

  return (
    <section
      id="top"
      aria-labelledby="hero-title"
      data-race-zone="hero"
      className="relative flex min-h-[min(100svh,68rem)] flex-col"
    >
      <HeroStage>
        <CarElevation className="block h-auto w-full" />
      </HeroStage>

      <div className="shell relative z-10 flex flex-1 flex-col pb-6 pt-[calc(var(--header-h)+clamp(1.25rem,4vh,3rem))]">
        <div className="relative">
          <div>
            <p className="label enter flex flex-wrap gap-x-3 gap-y-1 text-steel" style={enter(5)}>
              {profile.roles.map((role, index) => (
                <span key={role} className="flex items-center gap-3">
                  {index > 0 && <span aria-hidden="true" className="h-px w-4 bg-metal-3" />}
                  {role}
                </span>
              ))}
            </p>
            <h1
              id="hero-title"
              className="display enter-mask mt-4 text-[clamp(3.25rem,16.5vw,6.5rem)] uppercase md:mt-5 md:text-[clamp(4rem,9.1vw,9.5rem)]"
              style={enter(3)}
            >
              {profile.firstName}
              <br className="md:hidden" /> R Giri
            </h1>
          </div>

          {/* System readout — decorative restatement of the heading, so hidden from assistive tech. */}
          <div aria-hidden="true" className="label absolute right-0 top-0 hidden text-right text-faint xl:block">
            {system.map((line, index) => (
              <p key={line.key} className="enter-step flex justify-end gap-2 leading-[1.9]" style={enter(index)}>
                <span>{line.key}</span>
                <span className="text-metal-3">/</span>
                <span className={index === 0 ? "flex items-center gap-1.5 text-signal" : "text-steel"}>
                  {index === 0 && <span className="pulse-dot size-1 rounded-full bg-signal" />}
                  {line.value}
                </span>
              </p>
            ))}
          </div>
        </div>

        <div className="mt-6 flex flex-1 flex-col justify-between gap-10 md:mt-auto md:flex-none md:flex-row md:items-end">
          <div className="max-w-[30rem]">
            <p className="prose-body enter text-bone/90" style={enter(7)}>
              {profile.statement}
            </p>
            <div className="enter mt-7 flex flex-wrap items-center gap-3" style={enter(8)}>
              <ButtonLink href="#work" icon="arrow-down">
                Explore work
              </ButtonLink>
              <ButtonLink href={profile.resume.href} variant="secondary" icon="arrow-up-right">
                Résumé
              </ButtonLink>
            </div>
            <ul className="enter mt-5 flex flex-wrap gap-x-6" style={enter(9)}>
              {links.map((link) => {
                const icon = SOCIAL_ICON[link.id] ?? "mail";
                const external = !link.href.startsWith("mailto:");
                return (
                  <li key={link.id}>
                    <a
                      href={link.href}
                      {...(external ? { target: "_blank", rel: "noopener noreferrer" } : {})}
                      className="label inline-flex min-h-11 items-center gap-2 text-steel transition-colors duration-[var(--dur-fast)] hover:text-bone"
                    >
                      <Icon name={icon} size={15} />
                      {link.label}
                    </a>
                  </li>
                );
              })}
            </ul>
          </div>

          <div className="flex flex-col items-start gap-4 md:items-end">
            {/* Instrument row */}
            <ul className="enter-fade hidden border border-rule bg-carbon/40 backdrop-blur-sm md:flex" style={enter(11)}>
              {instruments.map((item) => (
                <li key={item.label} className="border-l border-rule first:border-l-0">
                  <Link
                    href={item.href}
                    className="group flex min-h-11 items-baseline gap-2.5 px-3.5 py-2.5 transition-colors duration-[var(--dur-fast)] hover:bg-graphite-2"
                  >
                    <span className="label text-faint transition-colors duration-[var(--dur-fast)] group-hover:text-steel">
                      {item.label}
                    </span>
                    <span className="readout text-[0.9375rem] text-bone transition-colors duration-[var(--dur-fast)] group-hover:text-signal">
                      {String(item.value).padStart(2, "0")}
                    </span>
                  </Link>
                </li>
              ))}
            </ul>
            <div className="enter-fade flex flex-wrap items-center gap-x-6 gap-y-2 md:justify-end" style={enter(12)}>
              <p className="label hidden text-faint md:block">
                <span className="text-steel">Fig. 01</span> — Original single-seater, modelled in code
              </p>
              {profile.availability.open && (
                <p className="label inline-flex shrink-0 items-center gap-2 text-steel">
                  <span aria-hidden="true" className="pulse-dot size-1.5 rounded-full bg-signal" />
                  {profile.availability.label}
                </p>
              )}
            </div>
          </div>
        </div>
      </div>
    </section>
  );
}
