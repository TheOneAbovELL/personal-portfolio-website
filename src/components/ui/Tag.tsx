import { statusLabel, type ProjectStatus } from "@/content";

/** A technology or concept. Plain text with a hairline box — not a coloured pill. */
export function Tag({ children }: { children: React.ReactNode }) {
  return (
    <li className="label border border-rule bg-graphite px-2 py-1 text-[0.6875rem] tracking-[0.08em] text-steel">
      {children}
    </li>
  );
}

/** Renders at most `limit` tags and summarises the rest, so long stacks never break a layout. */
export function TagList({ items, limit, label }: { items: string[]; limit?: number; label: string }) {
  const shown = limit ? items.slice(0, limit) : items;
  const hidden = items.length - shown.length;
  return (
    <ul className="flex flex-wrap gap-1.5" aria-label={label}>
      {shown.map((item) => (
        <Tag key={item}>{item}</Tag>
      ))}
      {hidden > 0 && (
        <li className="label px-1 py-1 text-[0.6875rem] tracking-[0.08em] text-faint">
          +{hidden}
          <span className="sr-only"> more</span>
        </li>
      )}
    </ul>
  );
}

/** States that are ongoing get a filled marker; everything else gets an outline. */
const LIVE: ProjectStatus[] = ["active", "in-development", "research"];

export function StatusBadge({ status }: { status: ProjectStatus }) {
  const live = LIVE.includes(status);
  return (
    <span className="label inline-flex items-center gap-2 text-bone">
      <span
        aria-hidden="true"
        className={`size-1.5 rounded-full ${live ? "bg-signal" : "border border-steel"}`}
      />
      {statusLabel[status]}
    </span>
  );
}
