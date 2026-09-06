import AdminPlaceholderPage from "@/components/admin/admin-placeholder-page";

export default function AuditAdminPage() {
  return <AdminPlaceholderPage eyebrow="System · Audit" title="Audit Logs" description="Audit infrastructure is active. A safe, redacted viewer is deferred; raw audit records remain closed." permissions={["configuration.read", "identity.read.directory"]} path="/admin/audit" />;
}
