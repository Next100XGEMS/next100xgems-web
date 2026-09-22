import ProjectSectionShell from "@/components/project-console/section-shell";
import { EmptyState, Panel } from "@/components/ui";
import { requireProjectAccess } from "@/lib/projects/authorization";
import { listProjectMembers } from "@/lib/projects/server";

export default async function TeamPage({
  params,
}: {
  params: Promise<{ projectId: string }>;
}) {
  const { projectId } = await params;
  const access = await requireProjectAccess(projectId, "project_viewer");
  const members = await listProjectMembers(access);

  return (
    <ProjectSectionShell
      eyebrow="Team"
      title="Project team"
      description="Bounded project membership. These roles are not platform Admin and cannot mutate Radar, Analyzer, or Research."
    >
      {members.length === 0 ? (
        <Panel tone="quiet">
          <EmptyState
            title="No members listed"
            description="Membership records for this project are not visible yet."
          />
        </Panel>
      ) : (
        <Panel tone="subtle" padding="sm">
          <ul className="divide-y divide-[var(--n100-border-subtle)]">
            {members.map((member) => (
              <li key={member.id} className="flex flex-wrap items-center justify-between gap-3 py-3">
                <span className="font-mono text-xs text-[var(--n100-text-secondary)]">{member.userId}</span>
                <span className="font-mono text-[0.625rem] uppercase tracking-[0.14em] text-[var(--n100-text-tertiary)]">
                  {member.role}
                </span>
              </li>
            ))}
          </ul>
        </Panel>
      )}
    </ProjectSectionShell>
  );
}
