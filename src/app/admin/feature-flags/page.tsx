import { getSystemFeatureFlags } from "@/lib/feature-flags/server";
import { Panel } from "@/components/ui";

import AdminAccessDenied from "@/components/admin/admin-access-denied";
import AdminPageHeader from "@/components/admin/admin-page-header";
import { getAdminPageAccess } from "@/components/admin/page-access";
import SystemStatusRow from "@/components/admin/system-status-row";

const featureFlagRows = [
  ["radar_enabled", "Radar", "Public Radar availability"],
  ["research_enabled", "Research", "Public research availability"],
  ["advertising_enabled", "Advertising", "Master paid-ad serving control"],
  ["featured_partners_enabled", "Featured Partners", "Partner display availability"],
  ["booking_enabled", "Bookings", "Booking entry points"],
  ["newsletter_enabled", "Newsletter", "Newsletter entry points"],
  ["maintenance_mode", "Maintenance Mode", "Conservative public availability state"],
  ["radar_auto_publish", "Radar Auto Publish", "OFF by default; review policy remains separate"],
  ["token_analyzer_enabled", "Token Analyzer", "Private internal analysis console; audited control"],
  ["token_analyzer_public_enabled", "Token Analyzer Public", "Prepared only; public route does not exist and remains OFF"],
  ["project_console_enabled", "Project Console", "Project-side console; fails closed"],
  ["project_claims_enabled", "Project Claims", "Ownership claim submissions; fails closed"],
  ["project_corrections_enabled", "Project Corrections", "Factual correction submissions; fails closed"],
] as const;

export default async function FeatureFlagsAdminPage() {
  const context = await getAdminPageAccess(["configuration.read"], "/admin/feature-flags");
  if (!context) {
    return <AdminAccessDenied message="Feature flag configuration is not available for the current application role." />;
  }

  const flags = await getSystemFeatureFlags();

  return (
    <div className="space-y-8">
      <AdminPageHeader eyebrow="System · Feature Flags" title="Feature Flags" description="Canonical Gate 7 availability reads, shown without mutation controls." status="READ ONLY" />
      <Panel family="admin" padding="sm">
        {featureFlagRows.map(([key, label, detail]) => {
          const enabled = flags[key];
          const isMaintenance = key === "maintenance_mode";
          const value = isMaintenance ? (enabled ? "RESTRICTED" : "OPEN") : enabled ? "ENABLED" : "DISABLED";
          const tone = isMaintenance && enabled ? "warning" : enabled ? "positive" : "neutral";
          return <SystemStatusRow key={key} label={label} value={value} tone={tone} detail={detail} />;
        })}
      </Panel>
      <p className="max-w-2xl text-sm leading-6 text-[var(--n100-text-tertiary)]">This surface is intentionally read-only. Feature-flag mutations require a future named, authorized, validated, and audited operation.</p>
    </div>
  );
}
