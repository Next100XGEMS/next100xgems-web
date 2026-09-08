import AdminAccessDenied from "@/components/admin/admin-access-denied";
import AdminPageHeader from "@/components/admin/admin-page-header";
import ResearchEditor from "@/components/admin/research-editor";
import { getAdminPageAccess } from "@/components/admin/page-access";
import { getAdminResearchEditorData } from "@/lib/research/admin";

export const dynamic = "force-dynamic";

export default async function NewResearchPage() {
  const context = await getAdminPageAccess(["research.read.all", "research.read.own_draft", "research.read.published"], "/admin/research/new");
  if (!context) return <AdminAccessDenied message="Research creation is not available for the current application role." />;
  if (!context.roles.some((role) => ["owner", "admin", "editor", "analyst"].includes(role))) return <AdminAccessDenied message="Your role can read Research but cannot create drafts." />;
  const data = await getAdminResearchEditorData(context);
  return <div className="space-y-8"><AdminPageHeader eyebrow="Content · Research" title="New draft" description="Draft content is private until an authorized reviewer explicitly publishes it." status="DRAFT" /><ResearchEditor mode="create" authors={data.authors} relations={data.relations} tokens={data.tokens} currentUserId={context.userId} canEdit canPublish={context.roles.some((role) => ["owner", "admin", "editor"].includes(role))} canClassify={context.roles.some((role) => ["owner", "admin"].includes(role))} canAssignAuthor={context.roles.some((role) => ["owner", "admin"].includes(role))} /></div>;
}
