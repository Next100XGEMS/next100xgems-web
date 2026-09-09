import { cleanup, render, screen } from "@testing-library/react";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";

const { mockGetFeatureFlags, mockIsFeatureEnabled, mockReadPage, mockReadArticle, mockNotFound } = vi.hoisted(() => ({
  mockGetFeatureFlags: vi.fn(),
  mockIsFeatureEnabled: vi.fn(),
  mockReadPage: vi.fn(),
  mockReadArticle: vi.fn(),
  mockNotFound: vi.fn(() => { throw new Error("NEXT_NOT_FOUND"); }),
}));

vi.mock("@/lib/feature-flags/server", () => ({
  getFeatureFlags: mockGetFeatureFlags,
  isFeatureEnabled: mockIsFeatureEnabled,
}));
vi.mock("@/lib/research/server", () => ({
  readPublicResearchPage: mockReadPage,
  readPublicResearchArticle: mockReadArticle,
}));
vi.mock("next/navigation", () => ({ notFound: mockNotFound }));

import ResearchPage from "@/app/(public)/research/page";
import ResearchArticleRoute, { generateMetadata } from "@/app/(public)/research/[slug]/page";

const summary = {
  id: "article-1",
  slug: "published-research",
  title: "Published Research",
  dek: "A real public summary.",
  category: "Market" as const,
  classification: "editorial" as const,
  aiAssisted: false,
  tldr: "A concise summary.",
  author: { name: "Public Desk", role: "Researcher" },
  publishedAt: "2026-09-07T00:00:00.000Z",
  updatedAt: "2026-09-07T01:00:00.000Z",
};

const article = {
  ...summary,
  tldr: "A concise article summary.",
  keyFacts: [{ label: "Fact", detail: "A public fact.", evidence: "verified-data" as const }],
  sections: [{ heading: "Context", paragraphs: ["A public paragraph."], blocks: [{ type: "paragraph" as const, text: "A public paragraph." }] }],
  sources: [{ title: "Source", publisher: "Publisher", url: "https://example.test/source" }],
  relatedResearch: [],
  relatedTokens: [],
  disclosure: "Independent editorial research.",
  seo: { title: "Published Research SEO", description: "A public SEO description." },
};

describe("public Research routes", () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  afterEach(() => cleanup());

  it("renders a real published landing result when Research is enabled", async () => {
    mockGetFeatureFlags.mockResolvedValue({ research_enabled: true });
    mockReadPage.mockResolvedValue([summary]);

    render(await ResearchPage());

    expect(screen.getByRole("link", { name: "Published Research" })).toBeTruthy();
    expect(screen.getByText("A real public summary.")).toBeTruthy();
    expect(mockReadPage).toHaveBeenCalledOnce();
  });

  it("does not query the public projection while Research is disabled", async () => {
    mockGetFeatureFlags.mockResolvedValue({ research_enabled: false });

    render(await ResearchPage());

    expect(screen.getByText(/research publishing is not currently active/i)).toBeTruthy();
    expect(mockReadPage).not.toHaveBeenCalled();
  });

  it("renders a published article and uses its values for metadata", async () => {
    mockIsFeatureEnabled.mockResolvedValue(true);
    mockReadArticle.mockResolvedValue(article);

    render(await ResearchArticleRoute({ params: Promise.resolve({ slug: article.slug }) }));
    const metadata = await generateMetadata({ params: Promise.resolve({ slug: article.slug }) });

    expect(screen.getByRole("heading", { name: article.title, level: 1 })).toBeTruthy();
    expect(metadata.title).toBe("Published Research SEO");
    expect(metadata.openGraph).toMatchObject({ url: "/research/published-research" });
  });

  it("renders nullable canonical token labels truthfully through the public route", async () => {
    mockIsFeatureEnabled.mockResolvedValue(true);
    mockReadArticle.mockResolvedValue({
      ...article,
      relatedTokens: [{ symbol: undefined, name: undefined, chain: "eip155:1", contract: "0xcanonical" }],
    });

    render(await ResearchArticleRoute({ params: Promise.resolve({ slug: article.slug }) }));

    expect(screen.getByText("Canonical token identity", { exact: true })).toBeTruthy();
    expect(screen.getByText("eip155:1 · 0xcanonical", { exact: true })).toBeTruthy();
    expect(screen.queryByText("Token · Unnamed", { exact: true })).toBeNull();
  });

  it("maps an empty public result to not-found", async () => {
    mockIsFeatureEnabled.mockResolvedValue(true);
    mockReadArticle.mockResolvedValue(null);

    await expect(ResearchArticleRoute({ params: Promise.resolve({ slug: "missing" }) })).rejects.toThrow("NEXT_NOT_FOUND");
    expect(mockNotFound).toHaveBeenCalledOnce();
  });

  it("does not turn a database failure into not-found", async () => {
    mockIsFeatureEnabled.mockResolvedValue(true);
    mockReadArticle.mockRejectedValue(new Error("temporary read failure"));

    await expect(ResearchArticleRoute({ params: Promise.resolve({ slug: "published-research" }) })).rejects.toThrow("temporary read failure");
    expect(mockNotFound).not.toHaveBeenCalled();
  });
});
