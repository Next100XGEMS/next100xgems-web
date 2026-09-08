import Link from "next/link";

import AdminAccessDenied from "@/components/admin/admin-access-denied";
import AdminPageHeader from "@/components/admin/admin-page-header";
import { Button, Panel, StatusLabel } from "@/components/ui";
import { getAdminPageAccess } from "@/components/admin/page-access";
import { listAdminResearch } from "@/lib/research/admin";
import { categoryLabels, classificationLabels, statusLabels } from "@/lib/research/admin-types";

export const dynamic = "force-dynamic";

const permissions = ["research.read.all", "research.read.own_draft", "research.read.published"] as const;
const canCreate = (roles: string[]) => roles.some((role) => ["owner", "admin", "editor", "analyst"].includes(role));

export default async function ResearchAdminPage() {
  const context = await getAdminPageAccess(permissions, "/admin/research");
  if (!context) return <AdminAccessDenied message="Research records are not available for the current application role." />;
  const { articles } = await listAdminResearch(context);
  const groups = ["DRAFT", "SCHEDULED", "PUBLISHED", "ARCHIVED"] as const;
  return <div className="space-y-10"><AdminPageHeader eyebrow="Content · Research" title="Research operations" description="A database-backed editorial workspace for controlled drafts, explicit publication, and visible disclosure." status="OPERATIONAL" /><div className="flex flex-wrap items-center justify-between gap-4"><p className="text-sm text-[var(--n100-text-tertiary)]">{articles.length === 0 ? "No Research records are visible to this session." : "Records are filtered by the active application role and current RLS policies."}</p>{canCreate(context.roles) ? <Link href="/admin/research/new" className="inline-flex min-h-10 items-center rounded-[var(--n100-radius-control)] bg-[var(--n100-accent)] px-4 text-sm font-medium text-[#11201a]">New Research draft</Link> : null}</div>{groups.map((status) => { const records = articles.filter((article) => article.status === status); return <section key={status} aria-labelledby={`research-${status.toLowerCase()}`}><div className="mb-4 flex items-end justify-between gap-4"><div><p className="font-mono text-[0.625rem] uppercase tracking-[0.16em] text-[var(--n100-accent)]">{statusLabels[status]}</p><h2 id={`research-${status.toLowerCase()}`} className="mt-2 text-xl font-semibold">{status === "DRAFT" ? "Working drafts" : status === "SCHEDULED" ? "Scheduled for explicit review" : status}</h2></div><span className="font-mono text-[0.625rem] uppercase tracking-[0.13em] text-[var(--n100-text-tertiary)]">{records.length} visible</span></div><Panel padding="sm">{records.length ? <div className="divide-y divide-[var(--n100-border-subtle)]">{records.map((article) => <Link key={article.id} href={`/admin/research/${article.id}`} className="flex flex-col gap-3 py-4 first:pt-1 last:pb-1 hover:bg-[var(--n100-surface-secondary)]/50 sm:flex-row sm:items-center sm:justify-between"><div className="min-w-0"><h3 className="truncate text-base font-medium text-[var(--n100-text-primary)]">{article.title || "Untitled Research"}</h3><p className="mt-1 truncate text-sm text-[var(--n100-text-tertiary)]">/{article.slug || "draft-slug"} · Revision {article.revision}{article.category ? ` · ${categoryLabels[article.category]}` : " · Category pending"}</p></div><div className="flex shrink-0 items-center gap-3"><StatusLabel kind={article.classification === "EDITORIAL" ? "editorial" : article.classification === "SPONSORED" ? "sponsored" : "partner"} /><span className="font-mono text-[0.625rem] uppercase tracking-[0.12em] text-[var(--n100-text-tertiary)]">{classificationLabels[article.classification]}</span></div></Link>)}</div> : <p className="py-5 text-sm text-[var(--n100-text-tertiary)]">No {statusLabels[status].toLowerCase()} records are visible.</p>}</Panel></section>})}<div className="flex gap-3"><Button variant="ghost" disabled>Metrics are intentionally not shown</Button><p className="self-center text-xs text-[var(--n100-text-tertiary)]">This surface reports records and states only; it does not invent performance data.</p></div></div>;
}
