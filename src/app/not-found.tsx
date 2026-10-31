import { ButtonLink } from "@/components/ui/Button";

/** Off the line. Set like a sector header, and it arrives like one. */
export default function NotFound() {
  return (
    <div className="section" data-tone="red">
      <div
        className="shell flex min-h-[80svh] flex-col justify-center pb-16 pt-[calc(var(--header-h)+3rem)]"
        style={{ "--enter-base": "200ms" } as React.CSSProperties}
      >
        <div className="sector-line scale-ticks enter-fade" aria-hidden="true" data-tone="red">
          <i />
        </div>
        <p className="label enter mt-4 text-steel">
          <span className="text-rosso-bright">404</span>
          <span aria-hidden="true" className="mx-2 text-metal-3">
            /
          </span>
          Off the line
        </p>
        <h1
          className="display enter-mask mt-[clamp(1.5rem,3vw,2.5rem)] text-[clamp(2.5rem,7vw,6rem)]"
          style={{ "--enter-index": 1 } as React.CSSProperties}
        >
          Page not found.
        </h1>
        <p className="prose-body enter measure mt-6 text-steel" style={{ "--enter-index": 2 } as React.CSSProperties}>
          That address doesn&rsquo;t lead anywhere. The work and the way back are below.
        </p>
        <div className="enter mt-8 flex flex-wrap gap-3" style={{ "--enter-index": 3 } as React.CSSProperties}>
          <ButtonLink href="/" icon="arrow-right">
            Home
          </ButtonLink>
          <ButtonLink href="/work" variant="secondary" icon="arrow-right">
            All work
          </ButtonLink>
        </div>
      </div>
    </div>
  );
}
