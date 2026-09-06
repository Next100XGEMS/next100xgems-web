import AdminPlaceholderPage from "@/components/admin/admin-placeholder-page";

export default function SettingsAdminPage() {
  return <AdminPlaceholderPage eyebrow="System · Settings" title="Site Settings" description="Operational settings remain separate from feature availability and are deferred." permissions={["configuration.read"]} path="/admin/settings" />;
}
