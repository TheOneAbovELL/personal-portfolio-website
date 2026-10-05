import { ButtonLink } from "@/components/ui/Button";

export default function NotFound() {
  return (
    <div className="shell flex min-h-[80svh] flex-col justify-center pb-16 pt-[calc(var(--header-h)+3rem)]">
      <p className="label text-steel">
        <span className="text-signal">404</span>
        <span aria-hidden="true" className="mx-2 text-rule-strong">
          /
        </span>
        Off the line
      </p>
      <h1 className="display mt-5 text-[clamp(2.75rem,9vw,8rem)] uppercase">Page not found.</h1>
      <p className="prose-body mt-6 max-w-[32rem] text-steel">
        That address doesn&rsquo;t lead anywhere. The work and the way back are below.
      </p>
      <div className="mt-8 flex flex-wrap gap-3">
        <ButtonLink href="/" icon="arrow-right">
          Home
        </ButtonLink>
        <ButtonLink href="/work" variant="secondary" icon="arrow-right">
          All work
        </ButtonLink>
      </div>
    </div>
  );
}
