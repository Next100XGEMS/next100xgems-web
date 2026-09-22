import Link from "next/link";

import OfficialDataForm from "@/components/project-console/official-data-form";
import ProjectSectionShell from "@/components/project-console/section-shell";
import { Panel } from "@/components/ui";
import { isFeatureEnabled } from "@/lib/feature-flags/server";
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
  const correctionsEnabled = await isFeatureEnabled("project_corrections_enabled");

  return (
    <ProjectSectionShell
      eyebrow="Official Data"
      title="Data Center"
      description="Bounded project-stated fields with provenance. Independently verified and intelligence fields cannot be overwritten here."
    >
      {correctionsEnabled ? (
        <Panel tone="quiet" padding="sm">
          <p className="text-sm text-[var(--n100-text-secondary)]">
            Need a reviewable change to an allowlisted field?{" "}
            <Link
              href={`/projects/${projectId}/corrections`}
              className="underline underline-offset-2"
            >
              Submit a factual correction
            </Link>
            . Score, risk, organic rank, and evidence remain forbidden.
          </p>
        </Panel>
      ) : null}
      <OfficialDataForm projectId={projectId} fields={fields} readOnly={!canEdit} />
    </ProjectSectionShell>
  );
}
