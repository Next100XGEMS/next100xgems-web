import AdminPlaceholderPage from "@/components/admin/admin-placeholder-page";

export default function LeadsAdminPage() {
  return <AdminPlaceholderPage eyebrow="Operations · Leads" title="Leads" description="Lead handling will be introduced with its privacy and lifecycle rules in a later gate." permissions={["leads.read"]} path="/admin/leads" />;
}
