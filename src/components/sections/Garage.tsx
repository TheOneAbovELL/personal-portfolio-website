import { Section } from "@/components/layout/Section";
import { Icon } from "@/components/ui/Icon";
import { profile } from "@/content";
import { getGarage } from "@/lib/github";
import { reveal } from "@/lib/reveal";
import { GarageBoard } from "./GarageBoard";

/**
 * The Garage — every other public repository, discovered from GitHub and lightly curated
 * (see content/garage.ts). Small projects are shown as what they are: small, and real.
 */
export async function Garage() {
  const { repos, live } = await getGarage();
  if (repos.length === 0) return null;
  const github = profile.socials.find((social) => social.id === "github");

  return (
    <Section
      id="garage"
      label="Garage"
      title="The rest of the grid."
      readout={`${String(repos.length).padStart(2, "0")} repositories · ${live ? "synced from GitHub" : "snapshot"}`}
      tone="yellow"
      layout="wide"
      aside={
        github && (
          <a
            href={github.href}
            target="_blank"
            rel="noopener noreferrer"
            className="label group inline-flex min-h-11 items-center gap-2 text-steel transition-colors duration-[var(--dur-fast)] hover:text-signal"
          >
            {github.handle} on GitHub
            <Icon
              name="arrow-up-right"
              size={14}
              className="transition-transform duration-[var(--dur-fast)] ease-[var(--ease-snap)] group-hover:-translate-y-0.5 group-hover:translate-x-0.5"
            />
          </a>
        )
      }
    >
      <p className="prose-body max-w-[40rem] text-steel" {...reveal("rise")}>
        Every experiment, tool and small system. Not flagship work — the things built along the way, listed as they
        are and updated automatically as new repositories appear.
      </p>
      <div className="mt-10" {...reveal("settle", 1)}>
        <GarageBoard repos={repos} />
      </div>
      <p className="label mt-4 flex items-center gap-2 text-faint">
        <span aria-hidden="true" className="size-1.5 bg-signal" />
        Worked on in the last 90 days
      </p>
    </Section>
  );
}
