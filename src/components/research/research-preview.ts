import type { ResearchArticle } from "./research-content";

export const researchPreviewArticle: ResearchArticle = {
  id: "development-fixture-research-structure",
  slug: "sample-research-structure",
  title: "Sample Research Structure",
  dek: "SAMPLE / DEVELOPMENT PREVIEW — neutral fixture content for reviewing article presentation only.",
  category: "Market",
  classification: "editorial",
  aiAssisted: true,
  author: { name: "Sample Research Desk", role: "Development fixture" },
  publishedAt: "2026-01-01",
  updatedAt: "2026-01-02",
  tldr: "This neutral fixture demonstrates how a reviewed article can separate context, observations, analysis, and uncertainty. It is not published research and does not describe a real asset or project.",
  keyFacts: [
    { label: "Fixture purpose", detail: "Review article hierarchy, evidence treatment, sources, and disclosure placement.", evidence: "unknown" },
    { label: "Production state", detail: "This content exists only for development review and is not part of the public research library.", evidence: "unknown" },
  ],
  sections: [
    { heading: "Observation", paragraphs: ["This sample section shows the intended readable measure for an article argument.", "A production article will replace this fixture with sourced material and a reviewed conclusion."], pullQuote: "Sample content should be unmistakable as sample content." },
    { heading: "Interpretation", paragraphs: ["This second section demonstrates how interpretation can follow observations without presenting a neutral layout as an investment signal."] },
  ],
  dataEmbeds: [{ label: "Sample data surface", description: "A future article may place a sourced chart or data module here. No live data is present in this preview." }],
  sources: [],
  relatedResearch: [],
  relatedTokens: [],
  disclosure: "SAMPLE / DEVELOPMENT PREVIEW — This is not published NEXT100XGEMS research and does not describe a real asset or project.",
};
