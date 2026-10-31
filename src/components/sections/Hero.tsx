import Link from "next/link";
import { CarElevation } from "@/components/figures/CarElevation";
import { HeroStage } from "@/components/three/HeroStage";
import { ButtonLink } from "@/components/ui/Button";
import { Icon, type IconName } from "@/components/ui/Icon";
import { featuredProjects, profile, skills } from "@/content";
import { getGarage } from "@/lib/github";

const enter = (index: number) => ({ "--enter-index": index }) as React.CSSProperties;

const SOCIAL_ICON: Partial<Record<string, IconName>> = { github: "github", linkedin: "linkedin", email: "mail" };
const HERO_SOCIALS = ["github", "linkedin", "instagram"];

/** Instagram's glyph, drawn to the same 24-unit grid and stroke as the site's other icons. */
function InstagramGlyph({ size = 15 }: { size?: number }) {
  return (
    <svg
      width={size}
      height={size}
      viewBox="0 0 24 24"
      fill="none"
      stroke="currentColor"
      strokeWidth={1.75}
      strokeLinecap="round"
      strokeLinejoin="round"
      aria-hidden="true"
      focusable="false"
    >
      <rect x="3.5" y="3.5" width="17" height="17" rx="4.75" />
      <circle cx="12" cy="12" r="3.9" />
      <circle cx="17.1" cy="6.9" r="0.6" fill="currentColor" stroke="none" />
    </svg>
  );
}

/**
 * The hero is the car's room. Type is kept to the edges of the frame and set small enough
 * that the car, not the copy, is the picture:
 *
 *   top-left      discipline and the name — the one place the name appears (the start
 *                 sequence hands its own lettering into this heading, see components/loader)
 *   bottom-left   statement and the two actions
 *   bottom-right  where to find me, three counts that link into the page, and the caption
 *
 * Entrances play in that order, after the drawing of the car has begun to draw itself.
 */
export async function Hero() {
  const garage = await getGarage();
  const links = [
    ...HERO_SOCIALS.flatMap((id) => profile.socials.filter((social) => social.id === id)),
    { id: "email", label: "Email", href: `mailto:${profile.email}` },
  ];

  // Every number here is counted from content and links to the section it describes.
  const instruments = [
    { label: "Domains", value: skills.length, href: "#capabilities" },
    { label: "Systems", value: featuredProjects().length, href: "#work" },
    { label: "Repositories", value: garage.repos.length, href: "#garage" },
  ];

  return (
    <section
      id="top"
      aria-labelledby="hero-title"
      data-race-zone="hero"
      className="hero relative flex min-h-[min(100svh,68rem)] flex-col"
    >
      <HeroStage>
        <CarElevation className="block h-auto w-full" />
      </HeroStage>

      <div className="shell relative z-10 flex flex-1 flex-col pb-[clamp(1.75rem,5vh,3rem)] pt-[calc(var(--header-h)+clamp(1.75rem,7vh,4.5rem))]">
        <div className="flex items-start justify-between gap-8">
          <div>
            <p className="label enter flex flex-wrap gap-x-3 gap-y-1 text-faint" style={enter(1)}>
              {profile.roles.map((role, index) => (
                <span key={role} className="flex items-center gap-3">
                  {index > 0 && <span aria-hidden="true" className="h-px w-3 bg-metal-3" />}
                  {role}
                </span>
              ))}
            </p>
            <h1 id="hero-title" className="hero-name display enter-mask mt-4 md:mt-5" style={enter(2)}>
              {profile.firstName}
              <br className="md:hidden" /> R Giri
            </h1>
          </div>

          {profile.availability.open && (
            <p className="label enter-fade mt-0.5 hidden shrink-0 items-center gap-2 text-steel md:inline-flex" style={enter(4)}>
              <span aria-hidden="true" className="pulse-dot size-1.5 rounded-full bg-signal" />
              {profile.availability.label}
            </p>
          )}
        </div>

        <div className="mt-8 flex flex-col gap-6 md:mt-auto md:flex-row md:items-end md:justify-between md:gap-10">
          <div className="max-w-[27rem]">
            <p className="hero-statement enter text-bone/85" style={enter(5)}>
              {profile.statement}
            </p>
            <div className="enter mt-7 flex flex-wrap items-center gap-x-7 gap-y-3" style={enter(6)}>
              <ButtonLink href="#work" icon="arrow-down">
                Explore work
              </ButtonLink>
              <ButtonLink href={profile.resume.href} variant="ghost" icon="arrow-up-right" className="hover:text-bone">
                Résumé
              </ButtonLink>
            </div>
            {profile.availability.open && (
              <p className="label enter-fade mt-6 inline-flex items-center gap-2 text-steel md:hidden" style={enter(7)}>
                <span aria-hidden="true" className="pulse-dot size-1.5 rounded-full bg-signal" />
                {profile.availability.label}
              </p>
            )}
          </div>

          <div className="flex flex-col gap-5 md:items-end">
            <ul className="enter-fade hidden gap-8 md:flex" style={enter(8)}>
              {instruments.map((item) => (
                <li key={item.label}>
                  <Link
                    href={item.href}
                    className="group inline-flex min-h-11 items-baseline gap-2 text-faint transition-colors duration-[var(--dur-fast)] hover:text-bone"
                  >
                    <span className="readout text-[0.9375rem] text-bone transition-colors duration-[var(--dur-fast)] group-hover:text-signal">
                      {String(item.value).padStart(2, "0")}
                    </span>
                    <span className="label">{item.label}</span>
                  </Link>
                </li>
              ))}
            </ul>
            <ul aria-label="Elsewhere" className="enter-fade flex flex-wrap gap-x-6 md:justify-end" style={enter(9)}>
              {links.map((link) => {
                const external = !link.href.startsWith("mailto:");
                const icon = SOCIAL_ICON[link.id];
                return (
                  <li key={link.id}>
                    <a
                      href={link.href}
                      {...(external ? { target: "_blank", rel: "noopener noreferrer" } : {})}
                      className="label inline-flex min-h-11 items-center gap-2 text-steel transition-colors duration-[var(--dur-fast)] hover:text-bone"
                    >
                      {icon ? <Icon name={icon} size={14} /> : <InstagramGlyph size={14} />}
                      {link.label}
                    </a>
                  </li>
                );
              })}
            </ul>
            <p className="label enter-fade hidden text-faint/80 md:block" style={enter(10)}>
              Fig. 01 — Original single-seater, modelled in code
            </p>
          </div>
        </div>
      </div>
    </section>
  );
}
