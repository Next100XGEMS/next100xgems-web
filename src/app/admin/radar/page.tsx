import AdminAccessDenied from "@/components/admin/admin-access-denied";
import AdminPageHeader from "@/components/admin/admin-page-header";
import RadarOperations from "@/components/admin/radar-operations";
import { getAdminPageAccess } from "@/components/admin/page-access";
import { listRadarAdminRecords } from "@/lib/radar/admin";
import { EmptyState } from "@/components/ui";

export const dynamic = "force-dynamic";
const permissions = ["radar.read.analysis", "radar.read.review"] as const;

export default async function RadarAdminPage() {
  const context = await getAdminPageAccess(permissions, "/admin/radar");
  if (!context) return <AdminAccessDenied message="Radar records are not available for the current application role." />;
  const records = await listRadarAdminRecords(context);
  const canReview = context.permissions.includes("radar.read.review") && context.roles.some((role) => ["owner", "admin", "radar_reviewer"].includes(role));
  const canProcess = context.permissions.includes("radar.read.analysis") && context.roles.some((role) => ["owner", "admin", "radar_reviewer", "analyst"].includes(role));
  return <div className="space-y-8"><AdminPageHeader eyebrow="Intelligence · Radar" title="Radar operations" description="Review states, frozen analytical inputs, evidence coverage and audited processing requests. Scores and evidence remain system-owned." status="CONTROLLED" />{records.length === 0 ? <EmptyState title="No Radar analyses are visible" description="The queue is empty for this role, or no analysis has reached the local database yet." /> : <div>{records.map((record) => <RadarOperations key={record.analysisId} record={record} canReview={canReview} canProcess={canProcess} />)}</div>}</div>;
}
