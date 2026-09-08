import { notFound } from "next/navigation";

import AdminAccessDenied from "@/components/admin/admin-access-denied";
import AdminPageHeader from "@/components/admin/admin-page-header";
import ResearchEditor from "@/components/admin/research-editor";
import { getAdminPageAccess } from "@/components/admin/page-access";
import { getAdminResearch, getAdminResearchEditorData } from "@/lib/research/admin";

export const dynamic = "force-dynamic";

export default async function ResearchAdminDetailPage({ params }: { params: Promise<{ id: string }> }) {
  const { id } = await params; const context = await getAdminPageAccess(["research.read.all", "research.read.own_draft", "research.read.published"], `/admin/research/${id}`);
  if (!context) return <AdminAccessDenied message="This Research record is not available for the current application role." />;
  const article = await getAdminResearch(context, id); if (!article) notFound();
  const data = await getAdminResearchEditorData(context, id);
  const canEdit = article.status === "DRAFT" && context.roles.some((role) => ["owner", "admin", "editor", "analyst"].includes(role)) && (context.roles.some((role) => ["owner", "admin", "editor"].includes(role)) || article.author_id === context.userId);
  const canPublish = context.roles.some((role) => ["owner", "admin", "editor"].includes(role)); const canClassify = context.roles.some((role) => ["owner", "admin"].includes(role)); const canAssignAuthor = canClassify;
  return <div className="space-y-8"><AdminPageHeader eyebrow="Content · Research" title={article.title || "Untitled Research"} description="Edit only through the named, audited Research operations. Revision conflicts require a refresh." status={article.status} /><ResearchEditor mode="edit" article={article} authors={data.authors} relations={data.relations} tokens={data.tokens} currentUserId={context.userId} canEdit={canEdit} canPublish={canPublish} canClassify={canClassify} canAssignAuthor={canAssignAuthor} /></div>;
}
