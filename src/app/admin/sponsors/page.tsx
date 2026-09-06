import AdminPlaceholderPage from "@/components/admin/admin-placeholder-page";

export default function SponsorsAdminPage() {
  return <AdminPlaceholderPage eyebrow="Commercial · Sponsors" title="Sponsors" description="Sponsor operations are planned, but no sponsor records or controls exist in Gate 10." permissions={["commercial.read"]} path="/admin/sponsors" />;
}
