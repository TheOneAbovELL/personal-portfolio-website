import { research } from "@/content";
import { researchStageLabel } from "@/content/research";
import { reveal } from "@/lib/reveal";

/**
 * The research signal chain: how a recording moves from 19 channels to a drafted report.
 * Each step says where it stands — the wire is solid through what is implemented and dashed
 * through what is still being built — and the prototype statement sits directly beneath it.
 */
export function SignalChain() {
  return (
    <div className="prog-chain">
      <div className="flex flex-wrap items-baseline justify-between gap-x-8 gap-y-2" {...reveal("snap")}>
        <p className="label text-steel">
          <span className="prog-ink">Signal chain</span>
          <span aria-hidden="true" className="mx-2 text-metal-3">
            /
          </span>
          Recording to report draft
        </p>
        <p className="label flex items-center gap-x-5 text-faint" aria-hidden="true">
          <span className="flex items-center gap-2">
            <span className="prog-bg h-px w-6" />
            {researchStageLabel.implemented}
          </span>
          <span className="flex items-center gap-2">
            <span className="w-6 border-t border-dashed border-[rgb(var(--prog-2))]" />
            {researchStageLabel["in-build"]}
          </span>
        </p>
      </div>

      <ol className="chain-steps mt-6">
        {research.flow.map((step, index) => (
          <li key={step.label} className="chain-step" data-stage={step.stage} {...reveal("snap", index)}>
            <span aria-hidden="true" className="chain-node" />
            <p className="label text-faint">
              {String(index + 1).padStart(2, "0")}
              <span aria-hidden="true" className="mx-1.5 text-metal-3">
                ·
              </span>
              <span className={step.stage === "in-build" ? "prog-ink-2" : "prog-ink"}>
                {researchStageLabel[step.stage]}
              </span>
            </p>
            <p className="display mt-2 text-[1.125rem] uppercase text-bone">{step.label}</p>
            <p className="mt-1.5 text-[0.875rem] leading-snug text-steel">{step.note}</p>
          </li>
        ))}
      </ol>

      <p
        className="mt-7 flex flex-wrap items-baseline gap-x-4 gap-y-1 border-l-2 border-papaya pl-4 text-[0.9375rem] leading-snug text-bone"
        {...reveal("rise", 1)}
      >
        <span className="label text-papaya">Experimental</span>
        {research.disclaimer}
      </p>
    </div>
  );
}
