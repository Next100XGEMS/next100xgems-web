import Link from "next/link";
import { notFound } from "next/navigation";

import CorrectionSubmitForm from "@/components/project-console/correction-submit-form";
import ProjectSectionShell from "@/components/project-console/section-shell";
import { Panel } from "@/components/ui";
import { isFeatureEnabled } from "@/lib/feature-flags/server";
import { requireProjectAccess } from "@/lib/projects/authorization";

export default async function ProjectCorrectionsPage({
  params,
}: {
  params: Promise<{ projectId: string }>;
}) {
  const { projectId } = await params;

  if (!(await isFeatureEnabled("project_corrections_enabled"))) {
    notFound();
  }

  const access = await requireProjectAccess(projectId, "project_viewer");
  const canSubmit = access.role === "project_owner" || access.role === "project_editor";

  return (
    <ProjectSectionShell
      eyebrow="Corrections"
      title="Factual corrections"
      description="Propose allowlisted Official Data corrections. Intelligence fields (score, risk, organic rank, evidence) are rejected. Staff review is required; paid status never implies verified."
    >
      <Panel tone="quiet" padding="sm">
        <p className="text-sm text-[var(--n100-text-secondary)]">
          Prefer editing unset or project-stated fields on{" "}
          <Link
            href={`/projects/${projectId}/official-data`}
            className="underline underline-offset-2"
          >
            Official Data
          </Link>{" "}
          when you have editor access. Use corrections for reviewable proposed changes.
        </p>
      </Panel>
      <CorrectionSubmitForm projectId={projectId} readOnly={!canSubmit} />
    </ProjectSectionShell>
  );
}
