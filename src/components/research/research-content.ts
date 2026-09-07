import type { Metadata } from "next";

export const researchCategories = [
  ["Market", "Structure, activity, liquidity, and the conditions shaping crypto markets."],
  ["Memecoins", "Narrative, attention, participation, and risk context in high-volatility markets."],
  ["Altcoins", "Project and ecosystem context beyond the largest market assets."],
  ["Deep Dives", "Longer-form investigations that connect evidence, interpretation, and uncertainty."],
] as const;

export type ResearchCategory = (typeof researchCategories)[number][0];
export type ResearchClassification = "editorial" | "sponsored" | "partner";
export type ResearchEvidenceKind = "verified-data" | "strong-signal" | "ai-inference" | "unknown";
export type ResearchBodyBlock =
  | { type: "paragraph"; text: string }
  | { type: "quote"; text: string; attribution?: string }
  | { type: "callout"; label: string; text: string }
  | { type: "data-placeholder"; label: string; description: string };

export type ResearchArticleSummary = {
  id: string;
  slug: string;
  title: string;
  dek?: string;
  category: ResearchCategory;
  classification: ResearchClassification;
  aiAssisted?: boolean;
  tldr?: string;
  author: { name: string; role?: string };
  publishedAt: string;
  updatedAt?: string;
};

export type ResearchArticle = {
  id: string;
  slug: string;
  title: string;
  dek?: string;
  category: ResearchCategory;
  classification: ResearchClassification;
  aiAssisted?: boolean;
  radarContext?: { summary: string; href?: string };
  author: { name: string; role?: string };
  publishedAt: string;
  updatedAt?: string;
  featuredImage?: { src: string; alt: string };
  tldr: string;
  keyFacts: Array<{ label: string; detail: string; evidence?: ResearchEvidenceKind }>;
  sections: Array<{ heading: string; paragraphs: string[]; pullQuote?: string; blocks?: ResearchBodyBlock[] }>;
  dataEmbeds?: Array<{ label: string; description: string }>;
  sources: Array<{ title: string; publisher: string; url: string; publishedAt?: string; accessedAt?: string }>;
  relatedResearch?: Array<{ slug: string; title: string; category: ResearchCategory }>;
  relatedTokens?: Array<{ symbol: string; name: string; chain: string; contract?: string; href?: string }>;
  disclosure: string;
  seo?: { title?: string; description?: string };
};

export const researchClassifications = [
  ["editorial", "EDITORIAL", "Independent research and editorial analysis."],
  ["sponsored", "SPONSORED", "Paid content or placement with visible disclosure."],
  ["partner", "PARTNER", "Content or context associated with a disclosed commercial relationship."],
  ["ai-assisted", "AI-ASSISTED", "AI contributed to analysis or production; it may coexist with another classification."],
] as const;

export const researchAnatomy = [
  ["TL;DR", "A concise reading of the article's central context and conclusion."],
  ["KEY FACTS", "Sourceable observations and context, with evidence states where supplied."],
  ["ANALYSIS", "Structured sections that separate observation, interpretation, and uncertainty."],
  ["SOURCES", "A clear trail back to supplied source material."],
  ["DISCLOSURE", "Commercial relationships, AI assistance, and relevant limits in plain sight."],
] as const;

export const publishedResearchArticles: readonly ResearchArticle[] = [];

export function getResearchArticleBySlug(slug: string) {
  return publishedResearchArticles.find((article) => article.slug === slug) ?? null;
}

export function generateResearchArticleMetadata(article: ResearchArticle): Metadata {
  const title = article.seo?.title ?? article.title;
  const description = article.seo?.description ?? article.dek ?? article.tldr;
  const canonical = `/research/${article.slug}`;

  return {
    title,
    description,
    alternates: { canonical },
    openGraph: { type: "article", title, description, url: canonical },
    twitter: { card: "summary", title, description },
  };
}

export function researchArticleStructuredData(article: ResearchArticle) {
  const structuredData: Record<string, unknown> = {
    "@context": "https://schema.org",
    "@type": "Article",
    headline: article.title,
    description: article.seo?.description ?? article.dek ?? article.tldr,
    author: { "@type": "Person", name: article.author.name },
    datePublished: article.publishedAt,
    mainEntityOfPage: { "@type": "WebPage", "@id": `/research/${article.slug}` },
    publisher: { "@type": "Organization", name: "NEXT100XGEMS" },
    articleSection: article.category,
  };

  if (article.updatedAt) {
    structuredData.dateModified = article.updatedAt;
  }

  return structuredData;
}

export function serializeResearchStructuredData(article: ResearchArticle) {
  return JSON.stringify(researchArticleStructuredData(article)).replace(/[<>&]/g, (character) => ({
    "<": "\\u003c",
    ">": "\\u003e",
    "&": "\\u0026",
  })[character] ?? character);
}
