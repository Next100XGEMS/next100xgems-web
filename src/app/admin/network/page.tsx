import AdminPlaceholderPage from "@/components/admin/admin-placeholder-page";

export default function NetworkAdminPage() {
  return <AdminPlaceholderPage eyebrow="Operations · Network" title="Network" description="Network and social-link operations are planned for a later product phase." permissions={["configuration.read", "identity.read.directory"]} path="/admin/network" />;
}
