import type { Metadata } from "next";
import { notFound } from "next/navigation";

import ResearchArticlePage from "@/components/research/research-article";
import { generateResearchArticleMetadata, getResearchArticleBySlug } from "@/components/research/research-content";

type ResearchRouteProps = { params: Promise<{ slug: string }> };

export async function generateMetadata({ params }: ResearchRouteProps): Promise<Metadata> {
  const { slug } = await params;
  const article = getResearchArticleBySlug(slug);
  return article ? generateResearchArticleMetadata(article) : { title: "Research not found — NEXT100XGEMS" };
}

export default async function ResearchArticleRoute({ params }: ResearchRouteProps) {
  const { slug } = await params;
  const article = getResearchArticleBySlug(slug);

  if (!article) {
    notFound();
  }

  return <ResearchArticlePage article={article} />;
}
