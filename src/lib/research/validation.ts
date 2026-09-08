import type { ResearchEditorInput, ResearchInputFact, ResearchInputSection, ResearchInputSource, ResearchAdminBlock } from "./admin-types";

export type ValidationResult = { ok: true; value: ResearchEditorInput } | { ok: false; error: string; field?: string };
const uuid = /^[0-9a-f]{8}-[0-9a-f]{4}-[1-5][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i;
const slug = /^[a-z0-9]+(?:-[a-z0-9]+)*$/;
const categories = new Set(["MARKET", "MEMECOINS", "ALTCOINS", "DEEP_DIVES"]);
const evidence = new Set(["VERIFIED_DATA", "STRONG_SIGNAL", "AI_INFERENCE", "UNKNOWN"]);
const blockTypes = new Set(["paragraph", "quote", "callout", "data_placeholder"]);

function text(value: unknown, field: string, max: number, required = false): string | null {
  if (typeof value !== "string" || value.length > max || /[\u0000-\u001f]/.test(value) || (required && value.trim() === "")) return null;
  return value;
}

function source(value: unknown): ResearchInputSource | null {
  if (!value || typeof value !== "object" || Array.isArray(value)) return null;
  const item = value as Record<string, unknown>;
  const title = text(item.title, "source title", 300, true); const publisher = text(item.publisher, "publisher", 200, true); const url = text(item.url, "source url", 2048, true);
  if (!title || !publisher || !url) return null;
  try { const parsed = new URL(url); if (!["http:", "https:"].includes(parsed.protocol) || parsed.username || parsed.password || /[\\<>\s\u0000-\u001f]/.test(url)) return null; } catch { return null; }
  const result: ResearchInputSource = { title, publisher, url };
  if (typeof item.id === "string") { if (!uuid.test(item.id)) return null; result.id = item.id; }
  for (const key of ["published_on", "accessed_on"] as const) { if (item[key] !== undefined && item[key] !== null) { const value = text(item[key], key, 10); if (!value || !/^\d{4}-\d{2}-\d{2}$/.test(value)) return null; result[key] = value; } }
  return result;
}

function block(value: unknown): ResearchAdminBlock | null {
  if (!value || typeof value !== "object" || Array.isArray(value)) return null;
  const item = value as Record<string, unknown>; if (typeof item.type !== "string" || !blockTypes.has(item.type)) return null;
  if (item.type === "data_placeholder") { const label = text(item.label, "data label", 160, true); const description = text(item.description, "data description", 10000, false); return label && description !== null ? { type: "data_placeholder", label, description } : null; }
  const body = text(item.text, "block text", 10000, false); if (body === null) return null;
  if (item.type === "paragraph") return { type: "paragraph", text: body };
  if (item.type === "quote") { const attribution = item.attribution === undefined ? undefined : text(item.attribution, "attribution", 240, false); return attribution === null ? null : { type: "quote", text: body, ...(attribution ? { attribution } : {}) }; }
  const label = text(item.label, "callout label", 120, true); return label ? { type: "callout", label, text: body } : null;
}

function documentBlocks(value: unknown): { version: 1; sections: ResearchInputSection[] } | null {
  if (!value || typeof value !== "object" || Array.isArray(value)) return null;
  const input = value as Record<string, unknown>; if (input.version !== 1 || !Array.isArray(input.sections) || input.sections.length > 40) return null;
  const ids = new Set<string>(); let total = 0; const sections: ResearchInputSection[] = [];
  for (const raw of input.sections) { if (!raw || typeof raw !== "object" || Array.isArray(raw)) return null; const item = raw as Record<string, unknown>; const id = text(item.id, "section id", 80, true); const heading = text(item.heading, "section heading", 160, false); if (!id || !heading || ids.has(id) || !Array.isArray(item.blocks) || item.blocks.length < 1 || item.blocks.length > 50) return null; ids.add(id); const blocks = item.blocks.map(block); if (blocks.some((entry) => entry === null)) return null; total += blocks.length; sections.push({ id, heading, blocks: blocks as ResearchAdminBlock[] }); }
  return total <= 250 ? { version: 1, sections } : null;
}

function facts(value: unknown): ResearchInputFact[] | null {
  if (!Array.isArray(value) || value.length > 12) return null;
  return value.map((raw) => { if (!raw || typeof raw !== "object" || Array.isArray(raw)) return null; const item = raw as Record<string, unknown>; const label = text(item.label, "fact label", 120, true); const detail = text(item.detail, "fact detail", 1000, true); const kind = item.evidence === undefined ? undefined : item.evidence; return label && detail && (kind === undefined || typeof kind === "string" && evidence.has(kind)) ? { label, detail, ...(kind ? { evidence: kind as ResearchInputFact["evidence"] } : {}) } : null; }).filter((value): value is ResearchInputFact => value !== null);
}

export function validateResearchInput(input: unknown, mode: "create" | "save"): ValidationResult {
  if (!input || typeof input !== "object" || Array.isArray(input)) return { ok: false, error: "Enter the required Research fields." };
  const raw = input as Record<string, unknown>;
  const title = text(raw.title, "title", 200, true); const slugValue = text(raw.slug, "slug", 160, true); const dek = text(raw.dek, "dek", 500, false); const tldr = text(raw.tldr, "TL;DR", 1200, true); const disclosure = text(raw.disclosure, "disclosure", 2000, true); const seoTitle = text(raw.seo_title, "SEO title", 200, false); const seoDescription = text(raw.seo_description, "SEO description", 320, false);
  if (!title || !slugValue || !slug.test(slugValue) || !tldr || !disclosure || dek === null || seoTitle === null || seoDescription === null) return { ok: false, error: "Check the title, lowercase slug, TL;DR, disclosure, and SEO fields." };
  const category = raw.category; if (typeof category !== "string" || !categories.has(category)) return { ok: false, error: "Choose a Research category.", field: "category" };
  const body_blocks = documentBlocks(raw.body_blocks); const key_facts = facts(raw.key_facts); if (!body_blocks || !key_facts) return { ok: false, error: "Check the structured content and Key Facts." };
  if (!Array.isArray(raw.sources) || raw.sources.length > 50) return { ok: false, error: "Add valid HTTPS/HTTP sources." }; const sources = raw.sources.map(source); if (sources.some((item) => item === null)) return { ok: false, error: "Each source needs a safe URL, title, and publisher." };
  const relatedResearch = raw.related_research; const relatedTokens = raw.related_tokens; if (!Array.isArray(relatedResearch) || !relatedResearch.every((item) => typeof item === "string" && uuid.test(item)) || !Array.isArray(relatedTokens) || !relatedTokens.every((item) => typeof item === "string" && uuid.test(item))) return { ok: false, error: "Check the selected related records." };
  const result: ResearchEditorInput = { title, slug: slugValue, dek, category: category as ResearchEditorInput["category"], ai_assisted: raw.ai_assisted === true, tldr, body_blocks, key_facts, disclosure, seo_title: seoTitle, seo_description: seoDescription, sources: sources as ResearchInputSource[], related_research: [...new Set(relatedResearch as string[])], related_tokens: [...new Set(relatedTokens as string[])] };
  if (mode === "create") { if (raw.classification !== undefined) { if (!["EDITORIAL", "SPONSORED", "PARTNER"].includes(String(raw.classification))) return { ok: false, error: "Choose a valid classification." }; result.classification = raw.classification as ResearchEditorInput["classification"]; } if (raw.author_id !== undefined) { if (typeof raw.author_id !== "string" || !uuid.test(raw.author_id)) return { ok: false, error: "Choose a valid public author." }; result.author_id = raw.author_id; } }
  if (mode === "save" && raw.reason !== undefined) { const reason = text(raw.reason, "reason", 500, true); if (reason === null) return { ok: false, error: "Provide a valid reason." }; result.reason = reason; }
  return { ok: true, value: result };
}
