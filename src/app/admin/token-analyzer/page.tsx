import AdminAccessDenied from "@/components/admin/admin-access-denied";
import AdminPageHeader from "@/components/admin/admin-page-header";
import TokenAnalyzerConsole from "@/components/admin/token-analyzer-console";
import { getAdminPageAccess } from "@/components/admin/page-access";
import { getAnalyzerSnapshot } from "@/lib/token-analyzer/server";

export const dynamic = "force-dynamic";

export default async function TokenAnalyzerAdminPage() {
  const context = await getAdminPageAccess(["configuration.read"], "/admin/token-analyzer");
  if (!context) return <AdminAccessDenied message="Universal Token Analyzer is available only to Owner and Admin roles." />;
  const snapshot = await getAnalyzerSnapshot();
  return <div className="space-y-8"><AdminPageHeader eyebrow="Intelligence · Internal" title="Universal Token Analyzer" description="Private development console for resolving token inputs, inspecting bounded evidence, and testing the deterministic analysis contract." status={snapshot.enabled ? "INTERNAL · ON" : "INTERNAL · OFF"} /><TokenAnalyzerConsole initialEnabled={snapshot.enabled} publicEnabled={snapshot.publicEnabled} analysisCount={snapshot.analysisCount} /><p className="text-xs leading-5 text-[var(--n100-text-tertiary)]">AI is disabled by default. No public Analyzer route or navigation item exists, and enabling this switch never enables public access.</p></div>;
}
