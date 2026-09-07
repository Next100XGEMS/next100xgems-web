import type { Metadata } from "next";
import { notFound } from "next/navigation";

import ResearchArticlePage from "@/components/research/research-article";
import { generateResearchArticleMetadata } from "@/components/research/research-content";
import { isFeatureEnabled } from "@/lib/feature-flags/server";
import { readPublicResearchArticle } from "@/lib/research/server";

export const dynamic = "force-dynamic";

type ResearchRouteProps = { params: Promise<{ slug: string }> };

async function getPublishedResearchArticle(slug: string) {
  if (!(await isFeatureEnabled("research_enabled"))) return null;
  return readPublicResearchArticle(slug);
}

export async function generateMetadata({ params }: ResearchRouteProps): Promise<Metadata> {
  const { slug } = await params;
  const article = await getPublishedResearchArticle(slug);
  return article ? generateResearchArticleMetadata(article) : { title: "Research not found — NEXT100XGEMS" };
}

export default async function ResearchArticleRoute({ params }: ResearchRouteProps) {
  const { slug } = await params;
  const article = await getPublishedResearchArticle(slug);

  if (!article) {
    notFound();
  }

  return <ResearchArticlePage article={article} />;
}
