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
      eyebrow="Media Kit"
      title="Media Kit"
      description="Assets and disclosure packs will appear here when provided."
      emptyTitle="No media kit yet"
      emptyDescription="A media kit has not been published for this project."
    />
  );
}
