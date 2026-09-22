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
      eyebrow="Overview · Ops desk"
      title="Project overview"
      description="Operational status for this claimed-project workspace. Intelligence scores, organic rank, and Analyzer conclusions are never controlled from this console."
    >
      <Panel family="admin" padding="md">
        <p className="font-mono text-[0.625rem] font-semibold uppercase tracking-[0.16em] text-[var(--n100-info)]">
          Workspace status board
        </p>
        <dl className="mt-5 grid gap-5 sm:grid-cols-3">
          <div className="border-l border-[var(--n100-info)]/40 pl-3">
            <dt className="font-mono text-[0.625rem] font-semibold uppercase tracking-[0.16em] text-[var(--n100-text-tertiary)]">
              Status
            </dt>
            <dd className="mt-1 font-mono text-sm text-[var(--n100-text-primary)]">{project?.status ?? "—"}</dd>
          </div>
          <div className="border-l border-[var(--n100-border-strong)]/50 pl-3">
            <dt className="font-mono text-[0.625rem] font-semibold uppercase tracking-[0.16em] text-[var(--n100-text-tertiary)]">
              Slug
            </dt>
            <dd className="mt-1 font-mono text-sm text-[var(--n100-text-primary)]">{project?.slug ?? "—"}</dd>
          </div>
          <div className="border-l border-[var(--n100-border-strong)]/50 pl-3">
            <dt className="font-mono text-[0.625rem] font-semibold uppercase tracking-[0.16em] text-[var(--n100-text-tertiary)]">
              Your role
            </dt>
            <dd className="mt-1 font-mono text-sm text-[var(--n100-text-primary)]">{access.role}</dd>
          </div>
        </dl>
      </Panel>

      <div className="grid gap-4 sm:grid-cols-2">
        <Panel tone="quiet" padding="md">
          <p className="font-mono text-[0.625rem] uppercase tracking-[0.14em] text-[var(--n100-text-tertiary)]">
            Official Data
          </p>
          <p className="mt-2 text-sm text-[var(--n100-text-secondary)]">
            Bounded project-stated fields with provenance. Verified and intelligence fields stay read-only.
          </p>
          <Link
            href={`/projects/${projectId}/official-data`}
            className="mt-4 inline-flex min-h-11 items-center text-sm font-semibold text-[var(--n100-accent)] underline underline-offset-4"
          >
            Open Official Data
          </Link>
        </Panel>
        <Panel tone="quiet" padding="md">
          <p className="font-mono text-[0.625rem] uppercase tracking-[0.14em] text-[var(--n100-text-tertiary)]">
            Deferred surfaces
          </p>
          <p className="mt-2 text-sm text-[var(--n100-text-secondary)]">
            Analytics and Campaigns remain honest empties. Campaign Studio is out of Phase 1 scope.
          </p>
          <div className="mt-4 flex flex-wrap gap-4 text-xs font-semibold">
            <Link href={`/projects/${projectId}/analytics`} className="text-[var(--n100-text-tertiary)] underline underline-offset-4">
              Analytics · COMING_SOON
            </Link>
            <Link href={`/projects/${projectId}/campaigns`} className="text-[var(--n100-text-tertiary)] underline underline-offset-4">
              Campaigns · COMING_SOON
            </Link>
          </div>
        </Panel>
      </div>

      {correctionsEnabled ? (
        <Panel tone="quiet" padding="sm">
          <p className="text-sm text-[var(--n100-text-secondary)]">
            Editors can propose allowlisted factual corrections via{" "}
            <Link href={`/projects/${projectId}/corrections`} className="underline underline-offset-2">
              Corrections
            </Link>
            . Paid status never implies verified.
          </p>
        </Panel>
      ) : null}
    </ProjectSectionShell>
  );
}
