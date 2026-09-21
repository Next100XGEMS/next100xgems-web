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
      eyebrow="Announcements"
      title="Announcements"
      description="Announcements will appear here when the project publishes them."
      emptyTitle="No announcements yet"
      emptyDescription="This project has not published any announcements."
    />
  );
}
