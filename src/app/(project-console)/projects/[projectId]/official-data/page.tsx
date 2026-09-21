import OfficialDataForm from "@/components/project-console/official-data-form";
import ProjectSectionShell from "@/components/project-console/section-shell";
import { requireProjectAccess } from "@/lib/projects/authorization";
import { listProjectFieldValues } from "@/lib/projects/server";

export default async function OfficialDataPage({
  params,
}: {
  params: Promise<{ projectId: string }>;
}) {
  const { projectId } = await params;
  const access = await requireProjectAccess(projectId, "project_viewer");
  const fields = await listProjectFieldValues(access);
  const canEdit = access.role === "project_owner" || access.role === "project_editor";

  return (
    <ProjectSectionShell
      eyebrow="Official Data"
      title="Data Center"
      description="Bounded project-stated fields with provenance. Independently verified and intelligence fields cannot be overwritten here."
    >
      <OfficialDataForm projectId={projectId} fields={fields} readOnly={!canEdit} />
    </ProjectSectionShell>
  );
}
