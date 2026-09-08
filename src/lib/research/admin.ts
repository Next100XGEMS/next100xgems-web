import "server-only";

import type { AuthorizationContext } from "@/lib/auth/authorization";
import type {
  AdminResearchArticle, AdminResearchAuthor, AdminResearchRelation, AdminResearchSummary, AdminResearchToken,
  ResearchAdminBlock, ResearchInputFact, ResearchInputSection, ResearchInputSource,
} from "./admin-types";

const articleColumns = "id,slug,title,dek,category,classification,ai_assisted,author_id,public_author_id,status,tldr,body_blocks,key_facts,disclosure,seo_title,seo_description,scheduled_at,published_at,created_at,updated_at,revision";

export class ResearchAdminReadError extends Error {
  constructor() { super("Research administration is temporarily unavailable."); this.name = "ResearchAdminReadError"; }
}

function record(value: unknown): Record<string, unknown> { if (!value || typeof value !== "object" || Array.isArray(value)) throw new ResearchAdminReadError(); return value as Record<string, unknown>; }
function stringValue(value: unknown, fallback = ""): string { return typeof value === "string" ? value : fallback; }
function nullableString(value: unknown): string | null { return typeof value === "string" ? value : null; }
function oneOf<T extends string>(value: unknown, allowed: readonly T[], fallback: T): T { return typeof value === "string" && allowed.includes(value as T) ? value as T : fallback; }
function finiteNumber(value: unknown): number { return typeof value === "number" && Number.isFinite(value) ? value : Number(value) || 1; }

const categories = ["MARKET", "MEMECOINS", "ALTCOINS", "DEEP_DIVES"] as const;
const classifications = ["EDITORIAL", "SPONSORED", "PARTNER"] as const;
const statuses = ["DRAFT", "SCHEDULED", "PUBLISHED", "ARCHIVED"] as const;

function mapBlock(value: unknown): ResearchAdminBlock {
  const item = record(value); const type = item.type;
  if (type === "paragraph") return { type, text: stringValue(item.text) };
  if (type === "quote") return { type, text: stringValue(item.text), ...(typeof item.attribution === "string" ? { attribution: item.attribution } : {}) };
  if (type === "callout") return { type, label: stringValue(item.label), text: stringValue(item.text) };
  if (type === "data_placeholder") return { type, label: stringValue(item.label), description: stringValue(item.description) };
  throw new ResearchAdminReadError();
}

function mapDocument(value: unknown): { version: 1; sections: ResearchInputSection[] } {
  const item = record(value); if (item.version !== 1 || !Array.isArray(item.sections)) throw new ResearchAdminReadError();
  return { version: 1, sections: item.sections.map((section) => { const row = record(section); if (!Array.isArray(row.blocks)) throw new ResearchAdminReadError(); return { id: stringValue(row.id), heading: stringValue(row.heading), blocks: row.blocks.map(mapBlock) }; }) };
}

function mapFacts(value: unknown): ResearchInputFact[] { if (!Array.isArray(value)) throw new ResearchAdminReadError(); return value.map((fact) => { const row = record(fact); const evidence = row.evidence; return { label: stringValue(row.label), detail: stringValue(row.detail), ...(typeof evidence === "string" ? { evidence: evidence as ResearchInputFact["evidence"] } : {}) }; }); }
function mapSources(value: unknown): ResearchInputSource[] { if (!Array.isArray(value)) throw new ResearchAdminReadError(); return value.map((source) => { const row = record(source); return { ...(typeof row.id === "string" ? { id: row.id } : {}), title: stringValue(row.title), publisher: stringValue(row.publisher), url: stringValue(row.url), published_on: nullableString(row.published_on), accessed_on: nullableString(row.accessed_on) }; }); }
function mapSummary(value: unknown): AdminResearchSummary {
  const row = record(value); return { id: stringValue(row.id), slug: stringValue(row.slug), title: stringValue(row.title), category: row.category === null ? null : oneOf(row.category, categories, "MARKET"), classification: oneOf(row.classification, classifications, "EDITORIAL"), ai_assisted: row.ai_assisted === true, status: oneOf(row.status, statuses, "DRAFT"), author_id: nullableString(row.author_id), public_author_id: nullableString(row.public_author_id), tldr: stringValue(row.tldr), scheduled_at: nullableString(row.scheduled_at), published_at: nullableString(row.published_at), updated_at: stringValue(row.updated_at), revision: finiteNumber(row.revision) };
}

function mapArticle(value: unknown, sources: unknown, relations: unknown, tokens: unknown): AdminResearchArticle {
  const row = record(value); return { ...mapSummary(value), dek: nullableString(row.dek), body_blocks: mapDocument(row.body_blocks), key_facts: mapFacts(row.key_facts), disclosure: stringValue(row.disclosure), seo_title: nullableString(row.seo_title), seo_description: nullableString(row.seo_description), created_at: stringValue(row.created_at), sources: mapSources(sources), related_research: Array.isArray(relations) ? relations.map((item) => stringValue(record(item).related_article_id)).filter(Boolean) : [], related_tokens: Array.isArray(tokens) ? tokens.map((item) => stringValue(record(item).token_id)).filter(Boolean) : [] };
}

async function checked<T>(promise: PromiseLike<{ data: T; error: unknown }>): Promise<T> { const result = await promise; if (result.error) throw new ResearchAdminReadError(); return result.data; }

export async function listAdminResearch(context: AuthorizationContext) {
  const [articleRows, authorRows] = await Promise.all([
    checked(context.supabase.from("articles").select(articleColumns).order("updated_at", { ascending: false })),
    checked(context.supabase.from("research_authors").select("profile_id,display_name,title").order("display_name", { ascending: true })),
  ]);
  const articles = (Array.isArray(articleRows) ? articleRows : []).map(mapSummary);
  const authors = (Array.isArray(authorRows) ? authorRows : []).map((value) => { const row = record(value); return { profile_id: stringValue(row.profile_id), display_name: stringValue(row.display_name), title: nullableString(row.title) } satisfies AdminResearchAuthor; });
  return { articles, authors };
}

export async function getAdminResearch(context: AuthorizationContext, id: string) {
  const articleRows = await checked(context.supabase.from("articles").select(articleColumns).eq("id", id).maybeSingle());
  if (!articleRows) return null;
  const [sources, relations, tokens] = await Promise.all([
    checked(context.supabase.from("article_sources").select("id,title,publisher,url,published_on,accessed_on,position").eq("article_id", id).is("retired_at", null).order("position", { ascending: true })),
    checked(context.supabase.from("article_related_research").select("related_article_id,position").eq("article_id", id).order("position", { ascending: true })),
    checked(context.supabase.from("article_tokens").select("token_id,position").eq("article_id", id).order("position", { ascending: true })),
  ]);
  return mapArticle(articleRows, sources, relations, tokens);
}

export async function getResearchRelations(context: AuthorizationContext, excludeId?: string) {
  const rows = await checked(context.supabase.from("articles").select("id,title,slug,category,status,updated_at").neq("id", excludeId ?? "00000000-0000-0000-0000-000000000000").order("updated_at", { ascending: false }));
  return (Array.isArray(rows) ? rows : []).map((value) => { const row = record(value); return { id: stringValue(row.id), title: stringValue(row.title), slug: stringValue(row.slug), category: row.category === null ? null : oneOf(row.category, categories, "MARKET"), status: oneOf(row.status, statuses, "DRAFT"), updated_at: stringValue(row.updated_at) } satisfies AdminResearchRelation; });
}

export async function getResearchTokens(context: AuthorizationContext, search = "") {
  const result = await context.supabase.rpc("research_token_options", { p_search: search, p_limit: 50 });
  if (result.error) return [] as AdminResearchToken[];
  return (Array.isArray(result.data) ? result.data : []).map((value) => { const row = record(value); return { id: stringValue(row.id), chain: stringValue(row.chain), contract_address: nullableString(row.contract_address), symbol: nullableString(row.symbol), name: nullableString(row.name) }; });
}

export async function getAdminResearchEditorData(context: AuthorizationContext, excludeId?: string) {
  const [list, relations, tokens] = await Promise.all([listAdminResearch(context), getResearchRelations(context, excludeId), getResearchTokens(context)]);
  return { ...list, relations, tokens };
}
