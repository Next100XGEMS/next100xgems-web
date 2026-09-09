import React from "react";

import { fireEvent, render, screen, waitFor } from "@testing-library/react";
import { describe, expect, it, vi } from "vitest";

const { mockChangeClassification, mockSaveDraft } = vi.hoisted(() => ({
  mockChangeClassification: vi.fn(),
  mockSaveDraft: vi.fn(),
}));

vi.mock("next/link", () => ({ default: ({ children, ...props }: { children: React.ReactNode; [key: string]: unknown }) => React.createElement("a", props, children) }));
vi.mock("next/navigation", () => ({ useRouter: () => ({ refresh: vi.fn(), replace: vi.fn() }) }));
vi.mock("@/app/admin/research/actions", () => ({
  changeResearchClassificationAction: mockChangeClassification,
  saveResearchDraftAction: mockSaveDraft,
  assignResearchAuthorAction: vi.fn(),
  createResearchDraftAction: vi.fn(),
  searchResearchTokensAction: vi.fn(),
  transitionResearchArticleAction: vi.fn(),
}));

import ResearchEditor from "@/components/admin/research-editor";

const article = {
  id: "10000000-0000-4000-8000-000000000301",
  title: "Original title",
  slug: "original-title",
  dek: "Context",
  category: "MARKET",
  classification: "EDITORIAL",
  ai_assisted: false,
  tldr: "Summary",
  body_blocks: { version: 1 as const, sections: [{ id: "context", heading: "Context", blocks: [{ type: "paragraph" as const, text: "Text" }] }] },
  key_facts: [{ label: "Fact", detail: "Detail", evidence: "UNKNOWN" as const }],
  disclosure: "Original editorial disclosure.",
  seo_title: "",
  seo_description: "",
  sources: [{ title: "Source", publisher: "Publisher", url: "https://example.com/source" }],
  related_research: [],
  related_tokens: [],
  author_id: "10000000-0000-4000-8000-000000000301",
  public_author_id: "10000000-0000-4000-8000-000000000301",
  revision: 1,
  status: "DRAFT",
} as const;

describe("Research editor classification synchronization", () => {
  it("reconciles the canonical disclosure before the next draft save", async () => {
    const canonicalDisclosure = "Canonical Sponsored disclosure.";
    let saved: { articleId: string; revision: number; input: Record<string, unknown> } | undefined;
    mockChangeClassification.mockResolvedValue({ ok: true, receipt: { article_id: article.id, revision: 2, status: "DRAFT", classification: "SPONSORED", disclosure: canonicalDisclosure } });
    mockSaveDraft.mockImplementation(async (articleId: string, revision: number, inputJson: string) => {
      saved = { articleId, revision, input: JSON.parse(inputJson) as Record<string, unknown> };
      return { ok: true, receipt: { article_id: article.id, revision: 3, status: "DRAFT" } };
    });

    render(<ResearchEditor mode="edit" article={article as never} authors={[{ profile_id: article.author_id, display_name: "Public author", title: "Researcher" }]} relations={[]} tokens={[]} currentUserId={article.author_id} canEdit canPublish canClassify canAssignAuthor />);
    fireEvent.change(screen.getByLabelText(/^Title/), { target: { value: "Unrelated unsaved title" } });
    fireEvent.change(screen.getByLabelText("Classification"), { target: { value: "SPONSORED" } });
    fireEvent.change(screen.getByLabelText("Disclosure for classification change"), { target: { value: canonicalDisclosure } });
    fireEvent.change(screen.getByLabelText("Reason for classification change"), { target: { value: "Approved commercial correction" } });
    fireEvent.click(screen.getByRole("button", { name: "Apply audited classification change" }));

    await waitFor(() => expect(screen.getByText("Saved. The audited Research operation completed.")).toBeTruthy());
    await waitFor(() => expect((screen.getAllByRole("button", { name: "Save Draft" })[0] as HTMLButtonElement).disabled).toBe(false));
    fireEvent.click(screen.getAllByRole("button", { name: "Save Draft" })[0]);
    await waitFor(() => expect(saved).toBeDefined());

    expect(saved).toMatchObject({
      articleId: article.id,
      revision: 2,
      input: { title: "Unrelated unsaved title", disclosure: canonicalDisclosure },
    });
    expect(saved?.input).not.toHaveProperty("classification");
    expect(mockChangeClassification).toHaveBeenCalledWith(article.id, 1, "SPONSORED", canonicalDisclosure, "Approved commercial correction");
  });
});
