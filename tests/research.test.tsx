import { cleanup, render, screen } from "@testing-library/react";
import { afterEach, describe, expect, it } from "vitest";

import ResearchArticlePage from "@/components/research/research-article";
import ResearchPageContent from "@/components/research/research-page";
import {
  generateResearchArticleMetadata,
  getResearchArticleBySlug,
  researchArticleStructuredData,
  serializeResearchStructuredData,
  type ResearchArticle,
} from "@/components/research/research-content";

afterEach(() => cleanup());

const fixture: ResearchArticle = {
  id: "fixture-article",
  slug: "fixture-article",
  title: "Fixture Research Article",
  dek: "Test-only article presentation fixture.",
  category: "Deep Dives",
  classification: "sponsored",
  aiAssisted: true,
  radarContext: { summary: "Test-only Radar context." },
  author: { name: "Fixture Desk", role: "Test fixture" },
  publishedAt: "2026-02-01",
  updatedAt: "2026-02-02",
  tldr: "Test-only TL;DR content.",
  keyFacts: [{ label: "Fixture fact", detail: "Test-only key fact.", evidence: "unknown" }],
  sections: [{ heading: "Fixture analysis", paragraphs: ["Test-only analysis paragraph."] }],
  sources: [{ title: "Fixture source", publisher: "Test fixture", url: "https://example.invalid/source" }],
  relatedResearch: [{ slug: "related-fixture", title: "Related fixture", category: "Market" }],
  relatedTokens: [{ symbol: "FIX", name: "Fixture Token", chain: "Test chain", contract: "fixture-contract" }],
  disclosure: "SAMPLE / TEST FIXTURE — not published research.",
};

describe("Gate 17 Research landing page", () => {
  it("shows confirmed categories, honest empty state, and product boundaries", () => {
    render(<ResearchPageContent researchEnabled={false} />);

    for (const category of ["Market", "Memecoins", "Altcoins", "Deep Dives"]) {
      expect(screen.getByRole("heading", { name: category })).toBeTruthy();
    }
    expect(screen.getByText(/no research has been published yet/i)).toBeTruthy();
    expect(screen.getByText(/research publishing is not currently active/i)).toBeTruthy();
    expect(screen.getByText(/radar surfaces intelligence. research investigates context/i)).toBeTruthy();
    expect(screen.getByRole("link", { name: "Read Methodology" })).toBeTruthy();
    expect(screen.getAllByRole("link", { name: "Read Disclosures" }).length).toBeGreaterThan(0);
    expect(screen.queryByText(/why bitcoin will rally|top 5 memecoins|solana deep dive/i)).toBeNull();
  });
});

describe("Gate 17 Research article architecture", () => {
  it("renders the typed fixture anatomy and prominent sponsored/AI disclosures", () => {
    render(<ResearchArticlePage article={fixture} previewLabel="SAMPLE / TEST FIXTURE" />);

    expect(screen.getByRole("heading", { name: fixture.title, level: 1 })).toBeTruthy();
    expect(screen.getByText("Deep Dives", { exact: true })).toBeTruthy();
    expect(screen.getAllByText("SPONSORED", { exact: true }).length).toBeGreaterThan(0);
    expect(screen.getAllByText("AI-ASSISTED", { exact: true }).length).toBeGreaterThan(0);
    expect(screen.getByText(fixture.tldr, { exact: true })).toBeTruthy();
    expect(screen.getByText("Fixture fact", { exact: true })).toBeTruthy();
    expect(screen.getByRole("link", { name: /fixture source \(opens in a new tab\)/i })).toBeTruthy();
    expect(screen.getAllByText(/sample \/ test fixture — not published research/i).length).toBeGreaterThan(0);
    expect(screen.getByText(/not a buy or sell recommendation/i)).toBeTruthy();
    expect(screen.getByRole("link", { name: "Related fixture" })).toBeTruthy();
    expect(screen.getByText(/Fixture Token/)).toBeTruthy();
    expect(screen.queryByRole("button")).toBeNull();
  });

  it("builds metadata and structured data from supplied fixture values only", () => {
    const metadata = generateResearchArticleMetadata(fixture);
    const structuredData = researchArticleStructuredData(fixture);
    const serialized = serializeResearchStructuredData(fixture);

    expect(metadata.title).toBe(fixture.title);
    expect(metadata.alternates?.canonical).toBe("/research/fixture-article");
    expect(metadata.openGraph).toMatchObject({ type: "article", url: "/research/fixture-article" });
    expect(structuredData.headline).toBe(fixture.title);
    expect(structuredData.datePublished).toBe(fixture.publishedAt);
    expect(structuredData.dateModified).toBe(fixture.updatedAt);
    expect(serialized).toContain(fixture.title);
    expect(serialized).toContain(fixture.author.name);
  });

  it("keeps nonexistent production slugs empty and unavailable", () => {
    expect(getResearchArticleBySlug("does-not-exist")).toBeNull();
  });
});
