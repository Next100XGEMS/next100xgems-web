import AdminPlaceholderPage from "@/components/admin/admin-placeholder-page";

export default function CampaignsAdminPage() {
  return <AdminPlaceholderPage eyebrow="Commercial · Campaigns" title="Campaigns" description="Campaign planning and delivery controls are deferred until the commercial phase." permissions={["commercial.read"]} path="/admin/campaigns" />;
}
