import AdminPlaceholderPage from "@/components/admin/admin-placeholder-page";

export default function NavigationAdminPage() {
  return <AdminPlaceholderPage eyebrow="System · Navigation" title="Navigation" description="Navigation editing is planned, but no editable configuration is exposed in Gate 10." permissions={["configuration.read"]} path="/admin/navigation" />;
}
