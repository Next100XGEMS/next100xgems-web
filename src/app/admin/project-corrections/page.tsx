import AdminAccessDenied from "@/components/admin/admin-access-denied";
import AdminPageHeader from "@/components/admin/admin-page-header";
import { getAdminPageAccess } from "@/components/admin/page-access";
import { EmptyState, Panel } from "@/components/ui";
import { listOpenProjectCorrections } from "@/lib/projects/server";

import CorrectionReviewControls from "./correction-review-controls";

export default async function ProjectCorrectionsAdminPage() {
  const context = await getAdminPageAccess(["configuration.read"], "/admin/project-corrections");
  if (!context) {
    return (
      <AdminAccessDenied message="Project correction review is not available for the current application role." />
    );
  }
  if (!context.roles.some((role) => role === "owner" || role === "admin")) {
    return <AdminAccessDenied message="Only Owner or Admin can review project corrections." />;
  }

  const corrections = await listOpenProjectCorrections(context.supabase);

  return (
    <div className="space-y-8">
      <AdminPageHeader
        eyebrow="Operations · Project Corrections"
        title="Project corrections"
        description="Factual corrections against allowlisted project fields only. Score, risk, organic rank, and evidence keys are rejected in the database."
        status="REVIEW QUEUE"
      />
      {corrections.length === 0 ? (
        <Panel family="admin">
          <EmptyState
            title="No open corrections"
            description="Submitted and in-review factual corrections will appear here."
          />
        </Panel>
      ) : (
        <div className="space-y-4">
          {corrections.map((item) => (
            <Panel key={item.id} family="admin" padding="sm">
              <div className="flex flex-col gap-4 lg:flex-row lg:justify-between">
                <div className="space-y-2">
                  <p className="text-sm font-medium text-[var(--n100-text-primary)]">{item.fieldKey}</p>
                  <p className="text-xs text-[var(--n100-text-secondary)]">{item.rationale}</p>
                  <p className="font-mono text-[0.625rem] text-[var(--n100-text-tertiary)]">
                    {item.state} · project {item.projectId}
                  </p>
                </div>
                <CorrectionReviewControls correctionId={item.id} state={item.state} />
              </div>
            </Panel>
          ))}
        </div>
      )}
    </div>
  );
}
