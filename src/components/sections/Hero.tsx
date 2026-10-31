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
 * The hero is the car's room. The car owns the frame — large, to the right, running off the
 * edge — and the type is set around it like a cover:
 *
 *   upper left    availability, discipline and the name (the loader hands its own lettering
 *                 into this heading, see components/loader)
 *   lower left    statement and the two actions
 *   base line     three counts that link into the page, and where to find me
 *
 * Entrances play in that order as the loader lifts (they wait under `intro-hold`).
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

      <div className="hero-frame shell relative z-10 flex flex-1 flex-col pb-[clamp(1.25rem,3.5vh,2.25rem)] pt-[calc(var(--header-h)+clamp(1.5rem,6vh,4rem))]">
        <div className="hero-copy">
          {profile.availability.open && (
            <p className="hero-chip enter-fade" style={enter(0)}>
              <span aria-hidden="true" className="pulse-dot size-1.5 rounded-full bg-rosso-bright" />
              {profile.availability.label}
            </p>
          )}
          <p className="label enter mt-6 flex flex-wrap gap-x-5 gap-y-1 sm:gap-x-3 text-steel md:mt-7" style={enter(1)}>
            {profile.roles.map((role, index) => (
              <span key={role} className="flex items-center gap-3">
                {index > 0 && <span aria-hidden="true" className="hidden h-px w-3 bg-metal-3 sm:block" />}
                {role}
              </span>
            ))}
          </p>
          <h1 id="hero-title" className="hero-name display enter-mask mt-3 md:mt-4" style={enter(2)}>
            {profile.name}
          </h1>
        </div>

        <div className="hero-car-room" aria-hidden="true" />

        <div className="hero-copy hero-lede">
          <p className="hero-statement enter text-bone/80" style={enter(4)}>
            {profile.statement}
          </p>
          <div className="enter mt-6 flex flex-wrap items-center gap-3 md:mt-7" style={enter(5)}>
            <ButtonLink href="#work" icon="arrow-down">
              Explore work
            </ButtonLink>
            <ButtonLink href={profile.resume.href} variant="secondary" icon="arrow-up-right">
              Résumé
            </ButtonLink>
          </div>
        </div>

        <div className="hero-base enter-fade" style={enter(7)}>
          <ul className="hero-instruments">
            {instruments.map((item) => (
              <li key={item.label}>
                <Link
                  href={item.href}
                  className="group inline-flex min-h-11 items-baseline gap-2 text-faint transition-colors duration-[var(--dur-fast)] hover:text-bone"
                >
                  <span className="hero-count transition-colors duration-[var(--dur-fast)] group-hover:text-rosso-bright">
                    {String(item.value).padStart(2, "0")}
                  </span>
                  <span className="label">{item.label}</span>
                </Link>
              </li>
            ))}
          </ul>

          <ul aria-label="Elsewhere" className="hero-socials">
            {links.map((link) => {
              const external = !link.href.startsWith("mailto:");
              const icon = SOCIAL_ICON[link.id];
              return (
                <li key={link.id}>
                  <a
                    href={link.href}
                    {...(external ? { target: "_blank", rel: "noopener noreferrer" } : {})}
                    aria-label={link.label}
                    title={link.label}
                    className="hero-social"
                  >
                    {icon ? <Icon name={icon} size={16} /> : <InstagramGlyph size={16} />}
                  </a>
                </li>
              );
            })}
          </ul>
        </div>
      </div>
    </section>
  );
}
