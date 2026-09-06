import AdminPlaceholderPage from "@/components/admin/admin-placeholder-page";

export default function UsersAdminPage() {
  return <AdminPlaceholderPage eyebrow="System · Identity" title="Users & Roles" description="Directory and role assignment remain placeholder-only. No invite, bootstrap, or assignment flow exists here." permissions={["identity.read.directory"]} path="/admin/users" />;
}
