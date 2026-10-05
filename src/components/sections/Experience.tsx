import Link from "next/link";
import { RatingTrace } from "@/components/figures/RatingTrace";
import { Section } from "@/components/layout/Section";
import { Icon } from "@/components/ui/Icon";
import { TagList } from "@/components/ui/Tag";
import {
  achievements,
  education,
  experience,
  formatRange,
  getProject,
  profile,
  projectHref,
  type ExperienceKind,
} from "@/content";
import { getCodeforces } from "@/lib/codeforces";
import { reveal } from "@/lib/reveal";

const KIND_LABEL: Record<ExperienceKind, string> = {
  research: "Research",
  "open-source": "Open source",
  internship: "Internship",
  work: "Work",
  freelance: "Freelance",
  hackathon: "Hackathon",
};

const titleCase = (value: string) => value.replace(/\b\w/g, (c) => c.toUpperCase());

/**
 * Experience, education and recognition on one calm, editorial timeline.
 * Entries come from content/experience.ts; a new internship is one more object there.
 */
export async function Experience() {
  const codeforces = await getCodeforces();
  const codeforcesUrl = profile.socials.find((social) => social.id === "codeforces")?.href;

  return (
    <Section
      id="experience"
      label="Experience"
      title="Research, open source and study."
      readout={`${String(experience.length).padStart(2, "0")} entries`}
      tone="red"
      surface="paper"
    >
      {/* Timeline: a vertical line with a node per entry; ongoing entries are lit. */}
      <ol className="relative border-l border-rule-strong">
        {experience.map((entry, index) => {
          const related = (entry.projects ?? []).map(getProject).filter((p) => p !== undefined);
          const ongoing = entry.end === null;
          return (
            <li key={entry.id} className="relative pb-12 pl-6 last:pb-2 sm:pl-10" {...reveal("rise", index)}>
              <span
                aria-hidden="true"
                className={`absolute -left-[4px] top-1.5 size-[7px] rounded-full ${
                  ongoing ? "bg-signal" : "border border-steel bg-carbon"
                }`}
              />
              <p className="label flex flex-wrap gap-x-4 gap-y-1 text-steel">
                <span className="text-bone">{formatRange(entry.start, entry.end)}</span>
                <span className="text-faint">{KIND_LABEL[entry.kind]}</span>
              </p>
              <h3 className="display mt-3 text-[1.5rem]">{entry.role}</h3>
              <p className="mt-2 text-[1.0625rem] text-bone">
                {entry.organization}
                {entry.unit && <span className="text-steel"> · {entry.unit}</span>}
              </p>
              <p className="mt-4 max-w-[46rem] text-[0.9875rem] leading-relaxed text-steel">{entry.summary}</p>

              <ul className="mt-5 max-w-[46rem] space-y-3">
                {entry.highlights.map((highlight, i) => (
                  <li key={i} className="grid grid-cols-[1rem_1fr] text-[0.9875rem] leading-relaxed text-bone/90">
                    <span aria-hidden="true" className="mt-[0.7em] h-px w-2 bg-signal" />
                    <span>
                      {highlight.text}
                      {highlight.links?.map((link) => (
                        <a
                          key={link.href}
                          href={link.href}
                          target="_blank"
                          rel="noopener noreferrer"
                          aria-label={`Pull request ${link.label} on GitHub`}
                          className="label ml-2 inline-block text-data underline decoration-data/30 underline-offset-4 transition-colors duration-[var(--dur-fast)] hover:text-bone hover:decoration-bone"
                        >
                          {link.label}
                        </a>
                      ))}
                    </span>
                  </li>
                ))}
              </ul>

              <div className="mt-6 flex flex-wrap items-center gap-x-6 gap-y-4">
                <TagList items={entry.stack} limit={8} label={`${entry.role} technologies`} />
                {related.map((project) => (
                  <Link key={project.slug} href={projectHref(project)} className="label link-underline text-bone hover:text-signal">
                    {project.title} case study →
                  </Link>
                ))}
              </div>
            </li>
          );
        })}
      </ol>

      <div className="mt-[clamp(3rem,6vw,4.5rem)] grid gap-x-10 gap-y-12 lg:grid-cols-2">
        {/* Education */}
        <div {...reveal("rise")}>
          <h3 className="label border-b border-rule-strong pb-3 text-bone">Education</h3>
          <ul>
            {education.map((entry) => (
              <li key={entry.id} className="border-b border-rule py-5">
                <p className="label text-steel">{formatRange(entry.start, entry.end)}</p>
                <p className="mt-2 text-[1.0625rem] font-medium text-bone">
                  {entry.degree}, {entry.field}
                </p>
                <p className="mt-0.5 text-[0.9375rem] text-steel">{entry.institution}</p>
              </li>
            ))}
          </ul>

          {achievements.map((achievement) => (
            <div key={achievement.id} className="border-b border-rule py-5">
              <p className="label text-steel">Recognition</p>
              <p className="mt-2 text-[1.0625rem] font-medium text-bone">{achievement.title}</p>
              <p className="mt-1 text-[0.9375rem] leading-relaxed text-steel">{achievement.detail}</p>
              {achievement.href && (
                <a
                  href={achievement.href}
                  target="_blank"
                  rel="noopener noreferrer"
                  className="label group mt-3 inline-flex min-h-11 items-center gap-2 text-bone transition-colors duration-[var(--dur-fast)] hover:text-signal"
                >
                  {achievement.linkLabel ?? "Learn more"}
                  <Icon
                    name="arrow-up-right"
                    size={13}
                    className="transition-transform duration-[var(--dur-fast)] ease-[var(--ease-snap)] group-hover:-translate-y-0.5 group-hover:translate-x-0.5"
                  />
                </a>
              )}
            </div>
          ))}
        </div>

        {/* Competitive programming — real, self-updating telemetry */}
        <article className="panel self-start" {...reveal("settle", 1)}>
          <div className="flex flex-wrap items-end justify-between gap-x-8 gap-y-4 p-5 sm:p-6">
            <div>
              <p className="label text-faint">Codeforces</p>
              <h3 className="display mt-2 text-[1.75rem]">{titleCase(codeforces.rank)}</h3>
            </div>
            <dl className="flex gap-8">
              <div>
                <dt className="label text-faint">Rating</dt>
                <dd className="readout mt-1 text-[1.5rem] text-signal">{codeforces.rating}</dd>
              </div>
              <div>
                <dt className="label text-faint">Rated contests</dt>
                <dd className="readout mt-1 text-[1.5rem] text-bone">{codeforces.history.length}</dd>
              </div>
            </dl>
          </div>
          <div className="px-3 pb-2 sm:px-4">
            <RatingTrace history={codeforces.history} />
          </div>
          <p className="label weave flex flex-wrap items-center justify-between gap-3 border-t border-rule px-5 py-3 text-faint sm:px-6">
            <span>
              <span className="text-steel">Fig. 05</span> — Rating after each rated contest.{" "}
              {codeforces.live ? "Refreshed daily." : "Snapshot."}
            </span>
            {codeforcesUrl && (
              <a
                href={codeforcesUrl}
                target="_blank"
                rel="noopener noreferrer"
                className="inline-flex items-center gap-1.5 text-steel transition-colors duration-[var(--dur-fast)] hover:text-signal"
              >
                {codeforces.handle}
                <Icon name="arrow-up-right" size={12} />
              </a>
            )}
          </p>
        </article>
      </div>
    </Section>
  );
}
