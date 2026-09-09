import type { Metadata } from "next";
import { notFound } from "next/navigation";

import ResearchArticlePage from "@/components/research/research-article";
import type { ResearchArticle, ResearchBodyBlock } from "@/components/research/research-content";
import AdminAccessDenied from "@/components/admin/admin-access-denied";
import { getAdminPageAccess } from "@/components/admin/page-access";
import { getAdminResearch, getResearchTokens } from "@/lib/research/admin";
import type { AdminResearchArticle } from "@/lib/research/admin-types";
import { categoryLabels } from "@/lib/research/admin-types";

export const dynamic = "force-dynamic";
export const metadata: Metadata = { title: "Research preview · NEXT100XGEMS", robots: { index: false, follow: false } };

function block(value: AdminResearchArticle["body_blocks"]["sections"][number]["blocks"][number]): ResearchBodyBlock {
  if (value.type === "data_placeholder") return { type: "data-placeholder", label: value.label, description: value.description };
  return value;
}
function previewArticle(article: AdminResearchArticle, tokens: Awaited<ReturnType<typeof getResearchTokens>>): ResearchArticle {
  const tokenMap = new Map(tokens.map((token) => [token.id, token]));
  return { id: article.id, slug: article.slug || article.id, title: article.title || "Untitled Research", dek: article.dek ?? undefined, category: categoryLabels[article.category ?? "MARKET"] as ResearchArticle["category"], classification: article.classification.toLowerCase() as ResearchArticle["classification"], aiAssisted: article.ai_assisted, author: { name: "Byline pending" }, tldr: article.tldr || "TL;DR pending", keyFacts: article.key_facts.map((fact) => ({ label: fact.label, detail: fact.detail, evidence: fact.evidence ? ({ VERIFIED_DATA: "verified-data", STRONG_SIGNAL: "strong-signal", AI_INFERENCE: "ai-inference", UNKNOWN: "unknown" } as const)[fact.evidence] : undefined })), sections: article.body_blocks.sections.map((section) => ({ heading: section.heading || "Untitled section", paragraphs: section.blocks.filter((item) => item.type === "paragraph").map((item) => item.text), blocks: section.blocks.map(block) })), sources: article.sources.filter((source) => /^https?:\/\//.test(source.url)).map((source) => ({ title: source.title, publisher: source.publisher, url: source.url, publishedAt: source.published_on ?? undefined, accessedAt: source.accessed_on ?? undefined })), relatedTokens: article.related_tokens.map((id) => tokenMap.get(id)).filter((token): token is NonNullable<typeof token> => Boolean(token)).map((token) => ({ symbol: token.symbol ?? undefined, name: token.name ?? undefined, chain: token.chain, contract: token.contract_address ?? undefined })), disclosure: article.disclosure || "Disclosure pending", seo: { title: article.seo_title ?? undefined, description: article.seo_description ?? undefined } };
}

export default async function ResearchAdminPreviewPage({ params }: { params: Promise<{ id: string }> }) {
  const { id } = await params; const context = await getAdminPageAccess(["research.read.all", "research.read.own_draft", "research.read.published"], `/admin/research/${id}/preview`);
  if (!context) return <AdminAccessDenied message="This Research preview is not available for the current application role." />;
  const article = await getAdminResearch(context, id); if (!article) notFound(); const tokens = await getResearchTokens(context); const view = previewArticle(article, tokens);
  return <div className="min-h-screen bg-[var(--n100-canvas)]"><div className="mx-auto flex max-w-[78rem] justify-end px-[var(--n100-gutter)] py-4"><a href={`/admin/research/${id}`} className="text-sm text-[var(--n100-accent)] underline underline-offset-4">Return to editor</a></div><ResearchArticlePage article={view} previewLabel="PREVIEW · UNPUBLISHED · NOT INDEXED" /></div>;
}
