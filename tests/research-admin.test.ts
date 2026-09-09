import { readFileSync } from "node:fs";
import { resolve } from "node:path";

import { describe, expect, it, vi } from "vitest";

import { validateResearchInput } from "@/lib/research/validation";
import { isBlankResearchText, isResearchSourceDate, isResearchSourceUrl, unicodeCodePointLength } from "@/lib/research/text";
import { createResearchDraftAction, changeResearchClassificationAction } from "@/app/admin/research/actions";

const { mockGetAuthorizationContext, mockRpc, mockRevalidatePath } = vi.hoisted(() => ({
  mockGetAuthorizationContext: vi.fn(),
  mockRpc: vi.fn(),
  mockRevalidatePath: vi.fn(),
}));

vi.mock("@/lib/auth/authorization", () => ({ getAuthorizationContext: mockGetAuthorizationContext }));
vi.mock("next/cache", () => ({ revalidatePath: mockRevalidatePath }));

const root = resolve(process.cwd());
const validInput = {
  title: "A controlled Research draft", slug: "controlled-research-draft", dek: "Context", category: "MARKET", ai_assisted: false,
  tldr: "A concise summary.", body_blocks: { version: 1, sections: [{ id: "context", heading: "Context", blocks: [{ type: "paragraph", text: "A sourced paragraph." }] }] },
  key_facts: [{ label: "Observation", detail: "A bounded detail.", evidence: "UNKNOWN" }], disclosure: "Independent editorial analysis.", seo_title: "", seo_description: "", sources: [{ title: "Source", publisher: "Publisher", url: "https://example.test/source" }], related_research: [], related_tokens: [],
};

function mockContext(roles: string[], canonical?: Record<string, unknown>) {
  mockGetAuthorizationContext.mockResolvedValue({
    roles,
    supabase: {
      rpc: mockRpc,
      from: () => ({ select: () => ({ eq: () => ({ maybeSingle: async () => ({ data: canonical ?? null, error: null }) }) }) }),
    },
  });
  mockRpc.mockResolvedValue({ data: { article_id: "article-1", revision: 1, status: "DRAFT" }, error: null });
  mockRevalidatePath.mockReset();
}

describe("Gate 18D Admin Research foundation", () => {
  it("accepts the exact Gate 18B structured document shape", () => {
    expect(validateResearchInput(validInput, "create")).toMatchObject({ ok: true });
  });

  it("rejects executable or unsupported content and unsafe source URLs", () => {
    expect(validateResearchInput({ ...validInput, body_blocks: { version: 1, sections: [{ id: "x", heading: "X", blocks: [{ type: "html", text: "<script>" }] }] } }, "create")).toMatchObject({ ok: false });
    expect(validateResearchInput({ ...validInput, sources: [{ title: "Source", publisher: "Publisher", url: "javascript:alert(1)" }] }, "create")).toMatchObject({ ok: false });
    expect(validateResearchInput({ ...validInput, slug: "Not safe" }, "create")).toMatchObject({ ok: false });
  });

  it("enforces the public source and structured-body boundaries before an RPC call", () => {
    expect(validateResearchInput({ ...validInput, sources: [{ title: "T".repeat(240), publisher: "P".repeat(160), url: "https://example.test/source" }] }, "create")).toMatchObject({ ok: true });
    expect(validateResearchInput({ ...validInput, sources: [{ title: "T".repeat(241), publisher: "Publisher", url: "https://example.test/source" }] }, "create")).toMatchObject({ ok: false });
    expect(validateResearchInput({ ...validInput, sources: [{ title: "Source", publisher: "P".repeat(161), url: "https://example.test/source" }] }, "create")).toMatchObject({ ok: false });
    expect(validateResearchInput({ ...validInput, body_blocks: { version: 1, sections: [{ id: "duplicate", heading: "One", blocks: [{ type: "paragraph", text: "A" }] }, { id: "duplicate", heading: "Two", blocks: [{ type: "paragraph", text: "B" }] }] } }, "create")).toMatchObject({ ok: false });
    expect(validateResearchInput({ ...validInput, body_blocks: { version: 1, sections: [{ id: "callout", heading: "Callout", blocks: [{ type: "callout", text: "Missing label" }] }] } }, "create")).toMatchObject({ ok: false });
    expect(validateResearchInput({ ...validInput, sources: [{ title: `${"T".repeat(240)} `, publisher: "Publisher", url: "https://example.test/source" }] }, "create")).toMatchObject({ ok: false });
    expect(validateResearchInput({ ...validInput, sources: [{ title: "Source", publisher: `${"P".repeat(160)} `, url: "https://example.test/source" }] }, "create")).toMatchObject({ ok: false });
    expect(validateResearchInput({ ...validInput, key_facts: [{ label: "Fact", detail: `${"D".repeat(1000)} `, evidence: "UNKNOWN" }] }, "create")).toMatchObject({ ok: false });
    expect(validateResearchInput({ ...validInput, body_blocks: { version: 1, sections: [{ id: " ", heading: "Blank", blocks: [{ type: "paragraph", text: "Text" }] }] } }, "create")).toMatchObject({ ok: false });
    expect(validateResearchInput({ ...validInput, body_blocks: { version: 1, sections: [{ id: "callout", heading: "Callout", blocks: [{ type: "callout", label: "\t", text: "Text" }] }] } }, "create")).toMatchObject({ ok: false });
    expect(validateResearchInput({ ...validInput, body_blocks: { version: 1, sections: [{ id: "unicode", heading: "Callout", blocks: [{ type: "callout", label: "😀".repeat(120), text: "Text" }] }] } }, "create")).toMatchObject({ ok: true });
    expect(unicodeCodePointLength("😀".repeat(120))).toBe(120);
  });

  it("uses the canonical Research whitespace corpus for required values", () => {
    const whitespace = [" ", "\t", "\n", "\r", "\u00a0", "\u1680", "\u2000", "\u2007", "\u2009", "\u2028", "\u2029", "\u202f", "\u205f", "\u3000", "\ufeff"];
    for (const value of whitespace) {
      expect(isBlankResearchText(value)).toBe(true);
      expect(validateResearchInput({ ...validInput, title: value }, "create")).toMatchObject({ ok: false });
      expect(validateResearchInput({ ...validInput, body_blocks: { version: 1, sections: [{ id: value, heading: "Heading", blocks: [{ type: "paragraph", text: "Text" }] }] } }, "create")).toMatchObject({ ok: false });
      expect(validateResearchInput({ ...validInput, body_blocks: { version: 1, sections: [{ id: "section", heading: "Heading", blocks: [{ type: "callout", label: value, text: "Text" }] }] } }, "create")).toMatchObject({ ok: false });
    }
    expect(isBlankResearchText(" \u2007\uFEFF\t")).toBe(true);
    expect(isBlankResearchText("\uFEFFvisible")).toBe(false);
  });

  it("uses the shared narrow URL and AD-only source-date contracts", () => {
    for (const url of ["https://example.com/source", "http://example.com/source", "https://sub.example.com/a?b=c#d", "https://127.0.0.1/source", "https://192.168.1.10/source"]) {
      expect(isResearchSourceUrl(url)).toBe(true);
      expect(validateResearchInput({ ...validInput, sources: [{ title: "Source", publisher: "Publisher", url }] }, "create")).toMatchObject({ ok: true });
    }
    for (const url of ["javascript:alert(1)", "data:text/html,test", "file:///tmp/test", "//example.com/path", "https://", "https://999.999.999.999/source", "https://256.1.1.1/source", "https://example..com/path", "https://user:pass@example.com/source"]) {
      expect(isResearchSourceUrl(url)).toBe(false);
      expect(validateResearchInput({ ...validInput, sources: [{ title: "Source", publisher: "Publisher", url }] }, "create")).toMatchObject({ ok: false });
    }
    for (const date of ["0001-01-01", "1970-01-01", "9999-12-31"]) expect(isResearchSourceDate(date)).toBe(true);
    for (const date of ["0001-01-01 BC", "10000-01-01", "2026-02-30", "2026/01/01"]) expect(isResearchSourceDate(date)).toBe(false);
  });

  it("keeps Admin mutations on named audited RPCs and out of direct table writes", () => {
    const source = readFileSync(resolve(root, "src/app/admin/research/actions.ts"), "utf8");
    expect(source).toContain('rpc("create_research_draft"');
    expect(source).toContain('rpc("save_research_draft"');
    expect(source).toContain('rpc("transition_research_article"');
    expect(source).toContain('rpc("change_research_classification"');
    expect(source).toContain('rpc("assign_research_author"');
    expect(source).not.toContain("SUPABASE_SECRET_KEY");
    expect(source).not.toContain('.from("articles").update');
    expect(source).not.toContain('.from("articles").insert');
  });

  it.each(["EDITORIAL", "SPONSORED", "PARTNER"] as const)("preserves an Editor-created %s classification", async (classification) => {
    mockContext(["editor"]);

    const result = await createResearchDraftAction(JSON.stringify({ ...validInput, classification }));

    expect(result.ok).toBe(true);
    expect(mockRpc).toHaveBeenCalledWith("create_research_draft", expect.objectContaining({
      p_input: expect.objectContaining({ classification }),
    }));
  });

  it("rejects an Analyst commercial classification instead of downgrading it", async () => {
    mockContext(["analyst"]);

    const result = await createResearchDraftAction(JSON.stringify({ ...validInput, classification: "SPONSORED" }));

    expect(result).toMatchObject({ ok: false, error: expect.stringContaining("Owner, Admin, or Editor") });
    expect(mockRpc).not.toHaveBeenCalled();
  });

  it("rejects a no-role commercial classification without silently converting it", async () => {
    mockContext([]);

    const result = await createResearchDraftAction(JSON.stringify({ ...validInput, classification: "PARTNER" }));

    expect(result).toMatchObject({ ok: false });
    expect(mockRpc).not.toHaveBeenCalled();
  });

  it("preserves valid Key Facts and rejects the entire submission when one is invalid", async () => {
    const validFacts = [{ label: "Risk", detail: "A bounded caveat.", evidence: "UNKNOWN" as const }];
    expect(validateResearchInput({ ...validInput, key_facts: validFacts }, "create")).toMatchObject({ ok: true, value: { key_facts: validFacts } });

    const invalidFacts = [validFacts[0], { label: "Oversized risk", detail: "R".repeat(1001), evidence: "UNKNOWN" as const }];
    expect(validateResearchInput({ ...validInput, key_facts: invalidFacts }, "create")).toMatchObject({ ok: false });
    expect(invalidFacts).toHaveLength(2);

    mockContext(["editor"]);
    const result = await createResearchDraftAction(JSON.stringify({ ...validInput, key_facts: invalidFacts }));
    expect(result).toMatchObject({ ok: false });
    expect(mockRpc).not.toHaveBeenCalled();
  });

  it("returns canonical classification, disclosure, and revision after the privileged change", async () => {
    mockContext(["owner"], { classification: "SPONSORED", disclosure: "Canonical paid disclosure.", revision: 2 });
    mockRpc.mockResolvedValue({ data: { article_id: "article-1", revision: 2, status: "DRAFT" }, error: null });

    const result = await changeResearchClassificationAction("article-1", 1, "SPONSORED", "Canonical paid disclosure.", "Reviewed compensation");

    expect(result).toMatchObject({ ok: true, receipt: { classification: "SPONSORED", disclosure: "Canonical paid disclosure.", revision: 2 } });
    expect(mockRpc).toHaveBeenCalledWith("change_research_classification", expect.anything());
  });

  it("merges the canonical classification receipt without resetting unrelated editor state", () => {
    const source = readFileSync(resolve(root, "src/components/admin/research-editor.tsx"), "utf8");
    expect(source).toContain("if (result.receipt?.classification)");
    expect(source).toContain("update({ classification: result.receipt.classification })");
    expect(source).toContain("setClassDisclosure(result.receipt.disclosure ?? \"\")");
    expect(source).toContain("update({ disclosure: result.receipt.disclosure })");
    expect(source).toContain("if (result.receipt?.revision) setRevision(result.receipt.revision)");
  });

  it("keeps previews private, noindex, and free of publication JSON-LD", () => {
    const source = readFileSync(resolve(root, "src/app/admin/research/[id]/preview/page.tsx"), "utf8");
    const renderer = readFileSync(resolve(root, "src/components/research/research-article.tsx"), "utf8");
    expect(source).toContain("index: false");
    expect(source).toContain("PREVIEW · UNPUBLISHED · NOT INDEXED");
    expect(renderer).toContain("!previewLabel");
    expect(renderer).toContain("Unpublished preview");
  });

  it("does not add migration or secret-key dependencies to Gate 18D", () => {
    expect(readFileSync(resolve(root, "src/lib/research/admin.ts"), "utf8")).not.toContain("SUPABASE_SECRET_KEY");
    expect(readFileSync(resolve(root, "src/lib/research/admin.ts"), "utf8")).toContain('from("articles")');
    expect(readFileSync(resolve(root, "src/app/admin/research/actions.ts"), "utf8")).not.toContain("writeAuditEvent");
  });

  it("provides section navigation and keeps draft save explicit and reachable", () => {
    const source = readFileSync(resolve(root, "src/components/admin/research-editor.tsx"), "utf8");
    expect(source).toContain('aria-label="Editor sections"');
    for (const section of ["article", "classification", "summary", "content", "sources", "relationships", "disclosure", "seo", "publication"]) {
      expect(source).toContain(`["${section}",`);
    }
    expect(source).toContain('onClick={save}');
    expect(source).toContain("there is no autosave");
  });

  it("keeps commercial disclosure prominent and makes optional metadata collapsible", () => {
    const source = readFileSync(resolve(root, "src/components/admin/research-editor.tsx"), "utf8");
    expect(source).toContain('id="classification"');
    expect(source).toContain('id="disclosure"');
    expect(source).toContain('id="relationships"');
    expect(source).toContain('id="seo"');
    expect(source.match(/<details open/g)?.length).toBe(2);
    expect(source).toContain("Publish");
    expect(source).toContain("Archive");
    expect(source).toContain("Restore → Draft");
    expect(source).not.toContain("Delete");
  });
});
