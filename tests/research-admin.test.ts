import { readFileSync } from "node:fs";
import { resolve } from "node:path";

import { describe, expect, it } from "vitest";

import { validateResearchInput } from "@/lib/research/validation";

const root = resolve(process.cwd());
const validInput = {
  title: "A controlled Research draft", slug: "controlled-research-draft", dek: "Context", category: "MARKET", ai_assisted: false,
  tldr: "A concise summary.", body_blocks: { version: 1, sections: [{ id: "context", heading: "Context", blocks: [{ type: "paragraph", text: "A sourced paragraph." }] }] },
  key_facts: [{ label: "Observation", detail: "A bounded detail.", evidence: "UNKNOWN" }], disclosure: "Independent editorial analysis.", seo_title: "", seo_description: "", sources: [{ title: "Source", publisher: "Publisher", url: "https://example.test/source" }], related_research: [], related_tokens: [],
};

describe("Gate 18D Admin Research foundation", () => {
  it("accepts the exact Gate 18B structured document shape", () => {
    expect(validateResearchInput(validInput, "create")).toMatchObject({ ok: true });
  });

  it("rejects executable or unsupported content and unsafe source URLs", () => {
    expect(validateResearchInput({ ...validInput, body_blocks: { version: 1, sections: [{ id: "x", heading: "X", blocks: [{ type: "html", text: "<script>" }] }] } }, "create")).toMatchObject({ ok: false });
    expect(validateResearchInput({ ...validInput, sources: [{ title: "Source", publisher: "Publisher", url: "javascript:alert(1)" }] }, "create")).toMatchObject({ ok: false });
    expect(validateResearchInput({ ...validInput, slug: "Not safe" }, "create")).toMatchObject({ ok: false });
  });

  it("keeps Admin mutations on named audited RPCs and out of direct table writes", () => {
    const source = readFileSync(resolve(root, "src/app/admin/research/actions.ts"), "utf8");
    expect(source).toContain('rpc("create_research_draft"');
    expect(source).toContain('rpc("save_research_draft"');
    expect(source).toContain('rpc("transition_research_article"');
    expect(source).toContain('rpc("change_research_classification"');
    expect(source).toContain('rpc("assign_research_author"');
    expect(source).not.toContain("SUPABASE_SECRET_KEY");
    expect(source).not.toContain('.from("articles")');
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
