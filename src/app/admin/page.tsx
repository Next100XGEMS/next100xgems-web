import { requireAdminAccess } from "@/lib/auth/authorization";
import { getSystemFeatureFlags } from "@/lib/feature-flags/server";
import { Container, Panel, Section } from "@/components/ui";

import AdminPageHeader from "@/components/admin/admin-page-header";
import SystemStatusRow from "@/components/admin/system-status-row";

export const dynamic = "force-dynamic";

const systemFlagRows = [
  { key: "radar_enabled", label: "Radar", detail: "Public intelligence availability" },
  { key: "research_enabled", label: "Research", detail: "Public research availability" },
  { key: "advertising_enabled", label: "Advertising", detail: "Paid placement availability" },
  { key: "featured_partners_enabled", label: "Featured Partners", detail: "Partner placement availability" },
  { key: "booking_enabled", label: "Bookings", detail: "Booking entry-point availability" },
  { key: "newsletter_enabled", label: "Newsletter", detail: "Newsletter entry-point availability" },
  { key: "maintenance_mode", label: "Maintenance Mode", detail: "Conservative public availability state" },
] as const;

function getFlagPresentation(key: (typeof systemFlagRows)[number]["key"], enabled: boolean) {
  if (key === "maintenance_mode") {
    return enabled
      ? { value: "RESTRICTED", tone: "warning" as const }
      : { value: "OPEN", tone: "positive" as const };
  }

  return enabled
    ? { value: "ENABLED", tone: "positive" as const }
    : { value: "DISABLED", tone: "neutral" as const };
}

function getEnvironmentLabel() {
  if (process.env.APP_ENV === "production" || process.env.VERCEL_ENV === "production") return "Production";
  if (process.env.APP_ENV === "staging" || process.env.VERCEL_ENV === "preview") return "Preview / staging";
  return "Local development";
}

export default async function AdminPage() {
  await requireAdminAccess();
  const flags = await getSystemFeatureFlags();

  return (
    <div className="space-y-12">
      <AdminPageHeader
        eyebrow="Overview · Gate 10"
        title="Operational clarity, before operational controls."
        description="A read-only view of the foundation currently protecting NEXT100XGEMS. Product workflows and audited mutations arrive in later gates."
        status="READ ONLY"
      />

      <Section density="compact" className="p-0" aria-labelledby="system-status-heading">
        <div className="mb-5 flex items-end justify-between gap-4">
          <div>
            <p className="text-[0.625rem] font-semibold uppercase tracking-[0.18em] text-[var(--n100-accent)]">System status</p>
            <h2 id="system-status-heading" className="mt-2 text-xl font-semibold tracking-[-0.025em]">Availability signals</h2>
          </div>
          <span className="font-mono text-[0.625rem] uppercase tracking-[0.13em] text-[var(--n100-text-tertiary)]">Server read</span>
        </div>
        <Panel family="admin" padding="sm">
          {systemFlagRows.map((row) => {
            const presentation = getFlagPresentation(row.key, flags[row.key] ?? false);
            return <SystemStatusRow key={row.key} label={row.label} value={presentation.value} tone={presentation.tone} detail={row.detail} />;
          })}
          <p className="mt-4 text-xs leading-5 text-[var(--n100-text-tertiary)]">These are read-only availability states. Missing or unreadable flags fail closed to documented safe defaults.</p>
        </Panel>
      </Section>

      <Section density="compact" className="p-0" aria-labelledby="foundation-status-heading">
        <div className="mb-5">
          <p className="text-[0.625rem] font-semibold uppercase tracking-[0.18em] text-[var(--n100-accent)]">Foundation status</p>
          <h2 id="foundation-status-heading" className="mt-2 text-xl font-semibold tracking-[-0.025em]">Security and runtime context</h2>
        </div>
        <Panel family="editorial" padding="sm">
          <SystemStatusRow label="Authentication" value="HEALTHY" tone="positive" detail="Verified session" />
          <SystemStatusRow label="Authorization" value="ACTIVE" tone="positive" detail="Live membership" />
          <SystemStatusRow label="Audit foundation" value="ACTIVE" tone="positive" detail="Append-only foundation" />
          <SystemStatusRow label="Environment" value={getEnvironmentLabel().toUpperCase()} detail="Safely inferred runtime" />
        </Panel>
      </Section>

      <Section density="compact" className="p-0" aria-labelledby="next-heading">
        <div className="mb-5">
          <p className="text-[0.625rem] font-semibold uppercase tracking-[0.18em] text-[var(--n100-accent)]">Operating principle</p>
          <h2 id="next-heading" className="mt-2 text-xl font-semibold tracking-[-0.025em]">Read now. Mutate later, with evidence.</h2>
        </div>
        <Container size="reading" className="px-0">
          <p className="text-sm leading-7 text-[var(--n100-text-secondary)]">The shell intentionally exposes status without controls. Future changes to flags, content, commercial records, roles, Radar review, or settings must pass fresh authorization, validation, and the audited mutation path.</p>
        </Container>
      </Section>
    </div>
  );
}
