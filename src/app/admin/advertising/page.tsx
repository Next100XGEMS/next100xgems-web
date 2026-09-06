import AdminPlaceholderPage from "@/components/admin/admin-placeholder-page";

export default function AdvertisingAdminPage() {
  return <AdminPlaceholderPage eyebrow="Commercial · Advertising" title="Advertising" description="Advertising inventory is planned for a later audited commercial workflow." permissions={["commercial.read"]} path="/admin/advertising" />;
}
