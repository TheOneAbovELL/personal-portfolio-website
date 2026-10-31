import { statusLabel, type ProjectStatus } from "@/content";

/** Work that is exploratory rather than shipped. Papaya is the palette's "experimental". */
const EXPERIMENTAL: ProjectStatus[] = ["research", "experimental"];
/** Work that is running or being built gets a solid marker; anything else an outline. */
const LIVE: ProjectStatus[] = ["active", "in-development", "research"];

/**
 * A programme's status in its own colour. Unlike the shared StatusBadge (always racing
 * yellow), this one speaks the programme's identity — and marks research as experimental.
 */
export function ProgrammeStatus({ status }: { status: ProjectStatus }) {
  const experimental = EXPERIMENTAL.includes(status);
  const marker = experimental ? "bg-papaya" : LIVE.includes(status) ? "prog-bg" : "border border-steel";
  return (
    <span className={`label inline-flex items-center gap-2.5 ${experimental ? "text-papaya" : "text-bone"}`}>
      <span aria-hidden="true" className={`size-1.5 rounded-full ${marker}`} />
      {statusLabel[status]}
    </span>
  );
}
