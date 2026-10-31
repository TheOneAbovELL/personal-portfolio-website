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

const titleCase = (value: string) =>
  value.replace(/\b\w/g, (c) => c.toUpperCase());

/**
 * Experience, education and recognition on one calm, editorial timeline.
 * Entries come from content/experience.ts; a new internship is one more object there.
 */
export async function Experience() {
  const codeforces = await getCodeforces();
  const codeforcesUrl = profile.socials.find(
    (social) => social.id === "codeforces",
  )?.href;

  return (
    <Section
      id="experience"
      label="Experience"
      title="Research, open source and study."
      readout={`${String(experience.length).padStart(2, "0")} entries`}
      tone="red"
      surface="paper"
      layout="wide"
    >
      {/* Timeline, set like a document: dates in the margin, the record beside them on a ruled
          line with a node per entry; ongoing entries are lit. */}
      <ol>
        {experience.map((entry, index) => {
          const related = (entry.projects ?? [])
            .map(getProject)
            .filter((p) => p !== undefined);
          const ongoing = entry.end === null;
          return (
            <li
              key={entry.id}
              className="grid lg:grid-cols-12 lg:gap-x-10"
              {...reveal("rise", index)}
            >
              <div className="lg:col-span-3">
                <p className="label flex flex-wrap gap-x-4 gap-y-1 pb-3 text-steel lg:sticky lg:top-[calc(var(--header-h)+2rem)] lg:block lg:pb-0 lg:pt-0.5">
                  <span className="text-bone lg:block">
                    {formatRange(entry.start, entry.end)}
                  </span>
                  <span className="text-faint lg:mt-2 lg:block">
                    {KIND_LABEL[entry.kind]}
                  </span>
                </p>
              </div>
              <div
                className={`relative border-l border-rule pl-6 sm:pl-10 lg:col-span-9 ${index === experience.length - 1 ? "pb-2" : "pb-16"}`}
              >
                <span
                  aria-hidden="true"
                  className={`absolute -left-[4px] top-1.5 size-[7px] rounded-full ${
                    ongoing
                      ? "bg-signal shadow-[0_0_0_4px_rgb(242_194_48/0.12)]"
                      : "border border-steel bg-carbon"
                  }`}
                />
                <h3 className="display text-[clamp(1.1875rem,1rem+0.6vw,1.4375rem)]">
                  {entry.role}
                </h3>
                <p className="mt-1.5 text-[1rem] text-bone/90">
                  {entry.organization}
                  {entry.unit && (
                    <span className="text-steel"> · {entry.unit}</span>
                  )}
                </p>
                <p className="mt-4 max-w-[44rem] text-[0.9375rem] leading-relaxed text-steel">
                  {entry.summary}
                </p>

                <ul className="mt-5 max-w-[44rem] space-y-2.5">
                  {entry.highlights.map((highlight, i) => (
                    <li
                      key={i}
                      className="grid grid-cols-[1rem_1fr] text-[0.9375rem] leading-relaxed text-bone/85"
                    >
                      <span
                        aria-hidden="true"
                        className="mt-[0.7em] h-px w-2 bg-signal"
                      />
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
                  <TagList
                    items={entry.stack}
                    limit={8}
                    label={`${entry.role} technologies`}
                  />
                  {related.map((project) => (
                    <Link
                      key={project.slug}
                      href={projectHref(project)}
                      className="label link-underline text-bone hover:text-signal"
                    >
                      {project.title} case study →
                    </Link>
                  ))}
                </div>
              </div>
            </li>
          );
        })}
      </ol>

      <div className="mt-[clamp(4rem,8vw,6.5rem)] grid gap-y-14 lg:grid-cols-12 lg:gap-x-10">
        {/* Education */}
        <div className="lg:col-span-4 lg:col-start-4" {...reveal("rise")}>
          <h3 className="label border-b border-rule pb-3 text-bone">
            Education
          </h3>
          <ul>
            {education.map((entry) => (
              <li key={entry.id} className="border-b border-rule py-5">
                <p className="label text-steel">
                  {formatRange(entry.start, entry.end)}
                </p>
                <p className="mt-2 text-[1rem] font-medium text-bone">
                  {entry.degree}, {entry.field}
                </p>
                <p className="mt-0.5 text-[0.9375rem] text-steel">
                  {entry.institution}
                </p>
              </li>
            ))}
          </ul>

          {achievements.map((achievement) => (
            <div key={achievement.id} className="border-b border-rule py-5">
              <p className="label text-steel">Recognition</p>
              <p className="mt-2 text-[1rem] font-medium text-bone">
                {achievement.title}
              </p>
              <p className="mt-1 text-[0.9375rem] leading-relaxed text-steel">
                {achievement.detail}
              </p>
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

        {/* Competitive programming — real, self-updating telemetry. A figure on the sheet, not a box. */}
        <article className="self-start lg:col-span-5" {...reveal("settle", 1)}>
          <div className="flex flex-wrap items-end justify-between gap-x-8 gap-y-4 border-b border-rule pb-5">
            <div>
              <p className="label text-faint">Codeforces</p>
              <h3 className="display mt-2 text-[clamp(1.25rem,1rem+0.8vw,1.625rem)]">
                {titleCase(codeforces.rank)}
              </h3>
            </div>
            <dl className="flex gap-8">
              <div>
                <dt className="label text-faint">Rating</dt>
                <dd className="readout mt-1 text-[1.375rem] text-signal">
                  {codeforces.rating}
                </dd>
              </div>
              <div>
                <dt className="label text-faint">Max</dt>
                <dd className="readout mt-1 text-[1.375rem] text-bone">
                  {codeforces.maxRating}
                </dd>
              </div>
              <div>
                <dt className="label text-faint">Rated contests</dt>
                <dd className="readout mt-1 text-[1.375rem] text-bone">
                  {codeforces.history.length}
                </dd>
              </div>
            </dl>
          </div>
          <div className="pt-4">
            <RatingTrace history={codeforces.history} />
          </div>
          <p className="label mt-2 flex flex-wrap items-center justify-between gap-3 text-faint">
            <span>
              <span className="text-steel">Fig. 05</span> — Rating after each
              rated contest.{" "}
              {codeforces.live ? "Refreshed daily." : "Snapshot."}
            </span>
            {codeforcesUrl && (
              <a
                href={codeforcesUrl}
                target="_blank"
                rel="noopener noreferrer"
                className="inline-flex min-h-11 items-center gap-1.5 text-steel transition-colors duration-[var(--dur-fast)] hover:text-signal"
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
