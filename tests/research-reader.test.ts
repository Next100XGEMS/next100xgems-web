import { beforeEach, describe, expect, it, vi } from "vitest";

const { mockCreateClient, mockRpc } = vi.hoisted(() => ({
  mockCreateClient: vi.fn(),
  mockRpc: vi.fn(),
}));

vi.mock("server-only", () => ({}));
vi.mock("@supabase/supabase-js", () => ({ createClient: mockCreateClient }));

import { ResearchReadError, readPublicResearchArticle, readPublicResearchPage } from "@/lib/research/server";

const listRow = {
  id: "10000000-0000-4000-8000-000000000101",
  slug: "fixture-published",
  title: "Published fixture",
  dek: "A public fixture deck.",
  category: "DEEP_DIVES",
  classification: "SPONSORED",
  ai_assisted: true,
  tldr: "A concise public summary.",
  author: { display_name: "Public author", title: "Researcher", email: "private@example.test" },
  published_at: "2026-09-07T00:00:00.000Z",
  updated_at: "2026-09-07T01:00:00.000Z",
};

const articleRow = {
  ...listRow,
  key_facts: [{ label: "Fact", detail: "A sourceable observation.", evidence: "VERIFIED_DATA" }],
  body_blocks: {
    version: 1,
    sections: [{
      id: "context",
      heading: "Context",
      blocks: [
        { type: "paragraph", text: "A bounded paragraph." },
        { type: "quote", text: "A bounded quote.", attribution: "Public source" },
        { type: "callout", label: "Context", text: "A bounded callout." },
        { type: "data_placeholder", label: "Data surface", description: "No live chart is present." },
      ],
    }],
  },
  disclosure: "Sponsored research with a visible disclosure.",
  seo_title: "Published fixture SEO title",
  seo_description: "Published fixture SEO description.",
  sources: [{ title: "Source", publisher: "Publisher", url: "https://example.test/source", published_on: "2026-09-01", accessed_on: "2026-09-07" }],
  related_research: [{ slug: "related-fixture", title: "Related fixture", category: "MARKET" }],
  related_tokens: [{ symbol: "FIX", name: "Fixture Token", chain: "eip155:1", contract_address: "0x1111" }],
};

describe("server Research reader", () => {
  beforeEach(() => {
    vi.clearAllMocks();
    vi.stubEnv("NEXT_PUBLIC_SUPABASE_URL", "https://supabase.example.test");
    vi.stubEnv("NEXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY", "public-key-test");
    mockCreateClient.mockReturnValue({ rpc: mockRpc });
  });

  it("maps the public list projection without private author fields", async () => {
    mockRpc.mockResolvedValue({ data: [listRow], error: null });

    await expect(readPublicResearchPage()).resolves.toEqual([expect.objectContaining({
      slug: "fixture-published",
      category: "Deep Dives",
      classification: "sponsored",
      aiAssisted: true,
      author: { name: "Public author", role: "Researcher" },
    })]);
    expect(mockRpc).toHaveBeenCalledWith("read_public_research_page", {
      p_category: null,
      p_cursor: null,
      p_limit: 20,
    });
  });

  it("maps article blocks, sources, relationships, classification, and SEO", async () => {
    mockRpc.mockResolvedValue({ data: [articleRow], error: null });

    const article = await readPublicResearchArticle("fixture-published");

    expect(article).toMatchObject({
      title: "Published fixture",
      classification: "sponsored",
      aiAssisted: true,
      author: { name: "Public author", role: "Researcher" },
      keyFacts: [{ label: "Fact", evidence: "verified-data" }],
      sections: [{ heading: "Context", paragraphs: ["A bounded paragraph."] }],
      sources: [{ url: "https://example.test/source", publishedAt: "2026-09-01" }],
      relatedResearch: [{ slug: "related-fixture", category: "Market" }],
      relatedTokens: [{ symbol: "FIX", name: "Fixture Token", chain: "eip155:1", contract: "0x1111" }],
      seo: { title: "Published fixture SEO title", description: "Published fixture SEO description." },
    });
    expect(article).not.toHaveProperty("author.email");
    expect(article).not.toHaveProperty("author.auth_id");
    expect(mockRpc).toHaveBeenCalledWith("read_public_research_article", { p_slug: "fixture-published" });
  });

  it("fails closed for an unknown body block instead of rendering it", async () => {
    mockRpc.mockResolvedValue({
      data: [{ ...articleRow, body_blocks: { version: 1, sections: [{ id: "x", heading: "X", blocks: [{ type: "html", text: "<script>" }] }] } }],
      error: null,
    });

    await expect(readPublicResearchArticle("fixture-published")).rejects.toBeInstanceOf(ResearchReadError);
  });

  it("fails closed for an unsafe source URL", async () => {
    mockRpc.mockResolvedValue({ data: [{ ...articleRow, sources: [{ ...articleRow.sources[0], url: "javascript:alert(1)" }] }], error: null });

    await expect(readPublicResearchArticle("fixture-published")).rejects.toBeInstanceOf(ResearchReadError);
  });

  it("distinguishes an empty public projection from a read failure", async () => {
    mockRpc.mockResolvedValueOnce({ data: [], error: null });
    await expect(readPublicResearchArticle("missing")).resolves.toBeNull();

    mockRpc.mockResolvedValueOnce({ data: null, error: new Error("database failure") });
    await expect(readPublicResearchArticle("missing")).rejects.toBeInstanceOf(ResearchReadError);
  });
});
