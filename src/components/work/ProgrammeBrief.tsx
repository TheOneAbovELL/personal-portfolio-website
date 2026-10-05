import { TagList } from "@/components/ui/Tag";
import type { Project } from "@/content";
import { ProgrammeStatus } from "./ProgrammeStatus";

/**
 * The brief beside a programme's figure: problem, system, technology, role, status.
 * Short enough to scan; the case study holds the argument. The `data-field` attributes let
 * each composition place the fields (see styles/work.css).
 */
export function ProgrammeBrief({ project }: { project: Project }) {
  const origin = [project.context, project.year].filter(Boolean).join(" · ");

  return (
    <dl className="brief">
      {project.brief && (
        <>
          <div data-field="problem">
            <dt className="label">Problem</dt>
            <dd className="text-[0.9875rem] leading-relaxed text-bone">{project.brief.problem}</dd>
          </div>
          <div data-field="system">
            <dt className="label">System</dt>
            <dd className="text-[0.9875rem] leading-relaxed text-bone">{project.brief.system}</dd>
          </div>
        </>
      )}
      <div data-field="technology">
        <dt className="label">Technology</dt>
        <dd>
          <TagList items={project.stack} limit={7} label={`${project.title} technologies`} />
        </dd>
      </div>
      {(project.role || origin) && (
        <div data-field="role">
          <dt className="label">Role</dt>
          <dd className="text-[0.9375rem] leading-snug text-bone">
            {project.role}
            {origin && <span className="mt-1 block text-[0.875rem] text-steel">{origin}</span>}
          </dd>
        </div>
      )}
      <div data-field="status">
        <dt className="label">Status</dt>
        <dd>
          <ProgrammeStatus status={project.status} />
          {project.statusNote && (
            <span className="mt-2 block text-[0.875rem] leading-snug text-steel">{project.statusNote}</span>
          )}
        </dd>
      </div>
    </dl>
  );
}
