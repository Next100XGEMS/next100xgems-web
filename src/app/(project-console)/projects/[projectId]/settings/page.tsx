import ProjectSectionShell from "@/components/project-console/section-shell";
import { Panel } from "@/components/ui";
import { requireProjectAccess } from "@/lib/projects/authorization";
import { getProjectForMember } from "@/lib/projects/server";

export default async function SettingsPage({
  params,
}: {
  params: Promise<{ projectId: string }>;
}) {
  const { projectId } = await params;
  const access = await requireProjectAccess(projectId, "project_viewer");
  const project = await getProjectForMember(access);

  return (
    <ProjectSectionShell
      eyebrow="Settings"
      title="Project settings"
      description="Basic identity settings for this project. Status changes that affect listing remain staff-mediated."
    >
      <Panel tone="subtle">
        <dl className="space-y-4">
          <div>
            <dt className="text-xs text-[var(--n100-text-tertiary)]">Display name</dt>
            <dd className="mt-1 text-sm">{project?.displayName}</dd>
          </div>
          <div>
            <dt className="text-xs text-[var(--n100-text-tertiary)]">Slug</dt>
            <dd className="mt-1 font-mono text-sm">{project?.slug}</dd>
          </div>
          <div>
            <dt className="text-xs text-[var(--n100-text-tertiary)]">Status</dt>
            <dd className="mt-1 font-mono text-sm">{project?.status}</dd>
          </div>
        </dl>
      </Panel>
    </ProjectSectionShell>
  );
}
