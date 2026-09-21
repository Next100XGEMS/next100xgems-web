import ProjectSectionShell from "@/components/project-console/section-shell";
import { requireProjectAccess } from "@/lib/projects/authorization";

export default async function Page({
  params,
}: {
  params: Promise<{ projectId: string }>;
}) {
  const { projectId } = await params;
  await requireProjectAccess(projectId, "project_viewer");

  return (
    <ProjectSectionShell
      eyebrow="Campaigns"
      title="Campaigns"
      description="Paid campaign tools are out of Project Platform Phase 1 scope."
      emptyTitle="Campaigns not available yet"
      emptyDescription="Campaign Studio is not available yet. This section is an empty shell only."
    />
  );
}
