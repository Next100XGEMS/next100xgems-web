import ProjectSectionShell from "@/components/project-console/section-shell";
import { requireProjectAccess } from "@/lib/projects/authorization";
import { getProjectForMember } from "@/lib/projects/server";
import { Panel } from "@/components/ui";

export default async function ProjectProfilePage({
  params,
}: {
  params: Promise<{ projectId: string }>;
}) {
  const { projectId } = await params;
  const access = await requireProjectAccess(projectId, "project_viewer");
  const project = await getProjectForMember(access);

  return (
    <ProjectSectionShell
      eyebrow="Profile"
      title="Project profile"
      description="Core identity fields for this project. Official Data Center holds versioned project-stated facts."
    >
      <Panel tone="subtle">
        <dl className="space-y-4">
          <div>
            <dt className="text-xs text-[var(--n100-text-tertiary)]">Display name</dt>
            <dd className="mt-1 text-sm text-[var(--n100-text-primary)]">{project?.displayName}</dd>
          </div>
          <div>
            <dt className="text-xs text-[var(--n100-text-tertiary)]">Slug</dt>
            <dd className="mt-1 font-mono text-sm text-[var(--n100-text-primary)]">{project?.slug}</dd>
          </div>
        </dl>
      </Panel>
    </ProjectSectionShell>
  );
}
