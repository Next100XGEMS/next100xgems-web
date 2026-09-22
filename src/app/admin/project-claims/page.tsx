import AdminAccessDenied from "@/components/admin/admin-access-denied";
import AdminPageHeader from "@/components/admin/admin-page-header";
import { getAdminPageAccess } from "@/components/admin/page-access";
import { EmptyState, Panel } from "@/components/ui";
import { listOpenProjectClaims } from "@/lib/projects/server";

import ClaimReviewControls from "./claim-review-controls";

export default async function ProjectClaimsAdminPage() {
  const context = await getAdminPageAccess(["configuration.read"], "/admin/project-claims");
  if (!context) {
    return <AdminAccessDenied message="Project claim review is not available for the current application role." />;
  }
  if (!context.roles.some((role) => role === "owner" || role === "admin")) {
    return <AdminAccessDenied message="Only Owner or Admin can review project claims." />;
  }

  const claims = await listOpenProjectClaims(context.supabase);

  return (
    <div className="space-y-8">
      <AdminPageHeader
        eyebrow="Operations · Project Claims"
        title="Project claims"
        description="Ownership and listing claims. Approval creates or links a project and grants project_owner membership. Staff Admin is never a project role."
        status="REVIEW QUEUE"
      />
      {claims.length === 0 ? (
        <Panel family="admin">
          <EmptyState
            title="No open claims"
            description="Submitted and in-review ownership claims will appear here."
          />
        </Panel>
      ) : (
        <div className="space-y-4">
          {claims.map((claim) => (
            <Panel key={claim.id} family="admin" padding="sm">
              <div className="flex flex-col gap-4 lg:flex-row lg:justify-between">
                <div className="space-y-2">
                  <p className="text-sm font-medium text-[var(--n100-text-primary)]">
                    {claim.proposedDisplayName}
                  </p>
                  <p className="font-mono text-xs text-[var(--n100-text-secondary)]">
                    {claim.proposedSlug} · {claim.state}
                  </p>
                  <p className="font-mono text-[0.625rem] text-[var(--n100-text-tertiary)]">
                    claimant {claim.claimantUserId}
                  </p>
                </div>
                <ClaimReviewControls claimId={claim.id} state={claim.state} />
              </div>
            </Panel>
          ))}
        </div>
      )}
    </div>
  );
}
