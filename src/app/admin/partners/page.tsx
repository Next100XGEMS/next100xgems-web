import AdminPlaceholderPage from "@/components/admin/admin-placeholder-page";

export default function PartnersAdminPage() {
  return <AdminPlaceholderPage eyebrow="Commercial · Partners" title="Featured Partners" description="Partner records and disclosed placements will be introduced in the commercial product phase." permissions={["partners.read.all", "partners.read.active"]} path="/admin/partners" />;
}
