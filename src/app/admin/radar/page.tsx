import AdminPlaceholderPage from "@/components/admin/admin-placeholder-page";

export default function RadarAdminPage() {
  return <AdminPlaceholderPage eyebrow="Intelligence · Radar" title="Radar" description="Radar review and publication workflows remain outside the Admin shell foundation." permissions={["radar.read.analysis", "radar.read.review"]} path="/admin/radar" />;
}
