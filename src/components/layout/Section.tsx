import { site, type SectionId } from "@/content/site";

/**
 * The accent that leads a section. Maps to the palette's meanings:
 * yellow = active/navigation, teal = intelligence/data, red = performance.
 */
export type Tone = "yellow" | "teal" | "red";

interface SectionProps {
  id: SectionId;
  label: string;
  title: React.ReactNode;
  /** A short, real readout shown at the right of the sector line, e.g. "06 domains". */
  readout?: string;
  tone?: Tone;
  /** "paper" sets the section on a graphite document sheet that fades in over the environment. Default is the open studio. */
  surface?: "studio" | "paper";
  /** Optional element on the heading row, e.g. a "view all" link. */
  aside?: React.ReactNode;
  /**
   * "split": label column on the left, content on the right (default).
   * "wide": heading on top, content across the full width.
   */
  layout?: "split" | "wide";
  children: React.ReactNode;
}

/** Two-digit sector number, derived from the section's position in `site.sections`. */
export function sectorNumber(id: SectionId): string {
  return String(site.sections.findIndex((section) => section.id === id) + 1).padStart(2, "0");
}

/** The sector line: an engineering scale with the racing line drawn across it. */
export function SectorLine({ tone = "yellow" }: { tone?: Tone }) {
  return (
    <div className="sector-line scale-ticks" data-tone={tone === "teal" ? "cyan" : tone} aria-hidden="true">
      <i data-reveal="trace" />
    </div>
  );
}

export function SectorLabel({ id, label, readout }: { id: SectionId; label: string; readout?: string }) {
  return (
    <div className="mt-4 flex items-baseline justify-between gap-6">
      <p className="label text-steel" data-reveal="snap">
        <span className="text-signal">{sectorNumber(id)}</span>
        <span aria-hidden="true" className="mx-2 text-metal-3">
          /
        </span>
        {label}
      </p>
      {readout && (
        <p className="label text-faint" data-reveal="snap" style={{ "--reveal-index": 2 } as React.CSSProperties}>
          {readout}
        </p>
      )}
    </div>
  );
}

/**
 * The frame every homepage section shares. Sections sit above the fixed hero stage, so each
 * paints its own surface; the sector line at the top is the recurring transition between them.
 */
export function Section({
  id,
  label,
  title,
  readout,
  tone = "yellow",
  surface = "studio",
  aside,
  layout = "split",
  children,
}: SectionProps) {
  const heading = (
    <h2 id={`${id}-title`} className="display title-section max-w-[24ch]" data-reveal="mask" data-drift="">
      <span className="mask">{title}</span>
    </h2>
  );

  return (
    <section
      id={id}
      aria-labelledby={`${id}-title`}
      className="section"
      data-race-zone={id}
      data-tone={tone}
      data-surface={surface}
    >
      <div className="shell py-[clamp(4.5rem,9vw,8.5rem)]">
        <SectorLine tone={tone} />
        <SectorLabel id={id} label={label} readout={readout} />

        {layout === "split" ? (
          <div className="mt-[clamp(1.5rem,3vw,2.5rem)] grid gap-y-6 lg:grid-cols-12 lg:gap-x-10">
            <div className="lg:col-span-9 lg:col-start-4">
              {heading}
              <div className="mt-[clamp(2rem,4vw,3.5rem)]">{children}</div>
            </div>
          </div>
        ) : (
          <>
            <div className="mt-[clamp(1.5rem,3vw,2.5rem)] grid gap-y-6 lg:grid-cols-12 lg:gap-x-10">
              <div className="flex flex-wrap items-end justify-between gap-x-8 gap-y-4 lg:col-span-9 lg:col-start-4">
                {heading}
                {aside}
              </div>
            </div>
            <div className="mt-[clamp(2.5rem,5vw,4.5rem)]">{children}</div>
          </>
        )}
      </div>
    </section>
  );
}
