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
      eyebrow="Analytics"
      title="Analytics"
      description="Usage and performance analytics are deferred; this page stays empty until a real data path exists. Flags fail closed — no fabricated charts."
      emptyCode="COMING_SOON"
      emptyTitle="Analytics not available yet"
      emptyDescription="NO_DATA for this surface. Analytics is not available yet. No metrics are fabricated for this ops desk."
    />
  );
}
