import AdminPlaceholderPage from "@/components/admin/admin-placeholder-page";

export default function ResearchAdminPage() {
  return <AdminPlaceholderPage eyebrow="Content · Research" title="Research" description="Editorial research workflows will be introduced in a later product gate." permissions={["research.read.all", "research.read.own_draft", "research.read.published"]} path="/admin/research" />;
}
