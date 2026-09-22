import Link from "next/link";

import ProjectSectionShell from "@/components/project-console/section-shell";
import { Panel } from "@/components/ui";
import { isFeatureEnabled } from "@/lib/feature-flags/server";
import { requireProjectAccess } from "@/lib/projects/authorization";
import { getProjectForMember } from "@/lib/projects/server";

export default async function ProjectOverviewPage({
  params,
}: {
  params: Promise<{ projectId: string }>;
}) {
  const { projectId } = await params;
  const access = await requireProjectAccess(projectId, "project_viewer");
  const project = await getProjectForMember(access);
  const correctionsEnabled = await isFeatureEnabled("project_corrections_enabled");

  return (
    <ProjectSectionShell
      eyebrow="Overview"
      title="Project overview"
      description="Status for this project workspace. Intelligence scores, organic rank, and Analyzer conclusions are never controlled from this console."
    >
      <Panel tone="subtle">
        <dl className="grid gap-4 sm:grid-cols-3">
          <div>
            <dt className="text-[0.625rem] font-semibold uppercase tracking-[0.16em] text-[var(--n100-text-tertiary)]">
              Status
            </dt>
            <dd className="mt-1 font-mono text-sm text-[var(--n100-text-primary)]">{project?.status ?? "—"}</dd>
          </div>
          <div>
            <dt className="text-[0.625rem] font-semibold uppercase tracking-[0.16em] text-[var(--n100-text-tertiary)]">
              Slug
            </dt>
            <dd className="mt-1 font-mono text-sm text-[var(--n100-text-primary)]">{project?.slug ?? "—"}</dd>
          </div>
          <div>
            <dt className="text-[0.625rem] font-semibold uppercase tracking-[0.16em] text-[var(--n100-text-tertiary)]">
              Your role
            </dt>
            <dd className="mt-1 font-mono text-sm text-[var(--n100-text-primary)]">{access.role}</dd>
          </div>
        </dl>
      </Panel>
      {correctionsEnabled ? (
        <Panel tone="quiet" padding="sm">
          <p className="text-sm text-[var(--n100-text-secondary)]">
            Editors can propose allowlisted factual corrections via{" "}
            <Link
              href={`/projects/${projectId}/corrections`}
              className="underline underline-offset-2"
            >
              Corrections
            </Link>
            . Paid status never implies verified.
          </p>
        </Panel>
      ) : null}
    </ProjectSectionShell>
  );
}
