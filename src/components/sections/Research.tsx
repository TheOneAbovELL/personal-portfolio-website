import Link from "next/link";
import { formatMonth, now, research, type NowGroup } from "@/content";
import { reveal } from "@/lib/reveal";

/** A group whose items are only names (no notes, no links) reads better as one line than as rows. */
const isPlainList = (group: NowGroup) => group.items.every((item) => !item.note && !item.href);

/**
 * Research and direction — the closing block of the Work sector, set as a ledger on the grid
 * the last programme's transition leaves behind. Calm on purpose: no figure, one accent.
 * It keeps its own anchor (#research) so links and Ask Omjee can point straight at it.
 */
export function ResearchDirection() {
  return (
    <div id="research" className="scroll-mt-28">
      <div className="scale-ticks" aria-hidden="true" data-reveal="trace" />
      <div className="mt-4 flex flex-wrap items-baseline justify-between gap-x-8 gap-y-2">
        <p className="label text-steel" {...reveal("snap")}>
          <span className="text-data">Research</span>
          <span aria-hidden="true" className="mx-2 text-metal-3">
            /
          </span>
          Direction
        </p>
        <p className="label text-faint" {...reveal("snap", 1)}>
          Updated {formatMonth(now.updated)}
        </p>
      </div>

      <div className="mt-[clamp(2rem,4vw,3.25rem)] grid gap-x-10 gap-y-10 lg:grid-cols-12">
        <div className="lg:col-span-4">
          <h3 className="display text-[clamp(1.75rem,3vw,2.5rem)]" {...reveal("mask")}>
            <span className="mask">Where the work is heading.</span>
          </h3>
          <p className="mt-5 text-[0.9875rem] leading-relaxed text-steel" {...reveal("rise", 1)}>
            {research.intro}
          </p>
        </div>

        <dl className="border-b border-rule lg:col-span-7 lg:col-start-6">
          {now.groups.map((group, index) => (
            <div
              key={group.label}
              className="grid gap-x-8 gap-y-3 border-t border-rule-strong py-5 sm:grid-cols-[9.5rem_minmax(0,1fr)]"
              {...reveal("rise", index)}
            >
              <dt className="label text-bone">
                <span className="mr-3 text-data">{String(index + 1).padStart(2, "0")}</span>
                {group.label}
              </dt>
              <dd>
                {isPlainList(group) ? (
                  <ul className="flex flex-wrap gap-x-2.5 gap-y-1.5">
                    {group.items.map((item, itemIndex) => (
                      <li key={item.title} className="flex items-center gap-2.5 text-[1rem] text-bone">
                        {item.title}
                        {itemIndex < group.items.length - 1 && (
                          <span aria-hidden="true" className="text-metal-3">
                            /
                          </span>
                        )}
                      </li>
                    ))}
                  </ul>
                ) : (
                  <ul className="space-y-4">
                    {group.items.map((item) => (
                      <li key={item.title} className="grid gap-x-6 gap-y-1 md:grid-cols-[minmax(0,15rem)_minmax(0,1fr)]">
                        {/* The link stays inline inside the cell, so its underline hugs the text. */}
                        <p className="text-[1rem] font-medium leading-snug text-bone">
                          {item.href ? (
                            <Link href={item.href} className="link-underline hover:text-signal">
                              {item.title}
                            </Link>
                          ) : (
                            item.title
                          )}
                        </p>
                        {item.note && <p className="text-[0.9375rem] leading-snug text-steel">{item.note}</p>}
                      </li>
                    ))}
                  </ul>
                )}
              </dd>
            </div>
          ))}
        </dl>
      </div>
    </div>
  );
}
