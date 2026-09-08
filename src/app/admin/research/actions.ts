"use server";

import { revalidatePath } from "next/cache";

import { getAuthorizationContext, type RoleKey } from "@/lib/auth/authorization";
import { validateResearchInput } from "@/lib/research/validation";

type Receipt = { article_id?: string; revision?: number; status?: string; audit_id?: string };
export type ResearchActionResult = { ok: true; receipt?: Receipt; articleId?: string } | { ok: false; error: string; field?: string };

function messageFor(error: { code?: string | null } | null) {
  switch (error?.code) { case "40001": return "This article changed since you opened it. Refresh before saving again."; case "42501": return "You are not authorized for this Research operation."; case "23505": return "That slug or relationship is already in use."; case "22023": case "23514": return "Check the highlighted fields and publication requirements."; case "55000": return "This lifecycle action is not available in the current state."; default: return "The Research operation could not be completed."; }
}
function rolesInclude(roles: RoleKey[], accepted: RoleKey[]) { return roles.some((role) => accepted.includes(role)); }
function parseJson(value: string) { try { return JSON.parse(value) as unknown; } catch { return null; } }
function success(receipt: unknown): ResearchActionResult { const value = receipt && typeof receipt === "object" ? receipt as Receipt : undefined; return { ok: true, receipt: value, articleId: value?.article_id }; }
function revalidateResearch(articleId?: string) { revalidatePath("/admin/research"); if (articleId) { revalidatePath(`/admin/research/${articleId}`); revalidatePath(`/admin/research/${articleId}/preview`); } revalidatePath("/research"); }

export async function createResearchDraftAction(inputJson: string): Promise<ResearchActionResult> {
  try { const context = await getAuthorizationContext(); if (!rolesInclude(context.roles, ["owner", "admin", "editor", "analyst"])) return { ok: false, error: "You are not authorized to create Research." }; const input = parseJson(inputJson); const valid = validateResearchInput(input, "create"); if (!valid.ok) return valid; if (!rolesInclude(context.roles, ["owner", "admin"])) { delete valid.value.classification; delete valid.value.author_id; } const { data, error } = await context.supabase.rpc("create_research_draft", { p_input: valid.value }); if (error) return { ok: false, error: messageFor(error) }; const result = success(data); if (result.ok) revalidateResearch(result.articleId); return result; } catch { return { ok: false, error: "Research administration is temporarily unavailable." }; }
}

export async function saveResearchDraftAction(articleId: string, expectedRevision: number, inputJson: string): Promise<ResearchActionResult> {
  try { const context = await getAuthorizationContext(); const input = parseJson(inputJson); const valid = validateResearchInput(input, "save"); if (!valid.ok) return valid; const { data, error } = await context.supabase.rpc("save_research_draft", { p_article_id: articleId, p_expected_revision: expectedRevision, p_input: valid.value }); if (error) return { ok: false, error: messageFor(error) }; const result = success(data); if (result.ok) revalidateResearch(articleId); return result; } catch { return { ok: false, error: "Research administration is temporarily unavailable." }; }
}

export async function transitionResearchArticleAction(articleId: string, expectedRevision: number, action: string, scheduledAt: string | null, reason: string | null): Promise<ResearchActionResult> {
  try { const context = await getAuthorizationContext(); if (!rolesInclude(context.roles, ["owner", "admin", "editor"])) return { ok: false, error: "You are not authorized for lifecycle changes." }; const { data, error } = await context.supabase.rpc("transition_research_article", { p_article_id: articleId, p_expected_revision: expectedRevision, p_action: action, p_scheduled_at: scheduledAt, p_reason: reason }); if (error) return { ok: false, error: messageFor(error) }; const result = success(data); if (result.ok) revalidateResearch(articleId); return result; } catch { return { ok: false, error: "Research administration is temporarily unavailable." }; }
}

export async function changeResearchClassificationAction(articleId: string, expectedRevision: number, classification: string, disclosure: string, reason: string): Promise<ResearchActionResult> {
  try { const context = await getAuthorizationContext(); if (!rolesInclude(context.roles, ["owner", "admin"])) return { ok: false, error: "Only Owner or Admin can change Research classification." }; const { data, error } = await context.supabase.rpc("change_research_classification", { p_article_id: articleId, p_expected_revision: expectedRevision, p_classification: classification, p_disclosure: disclosure, p_reason: reason }); if (error) return { ok: false, error: messageFor(error) }; const result = success(data); if (result.ok) revalidateResearch(articleId); return result; } catch { return { ok: false, error: "Research administration is temporarily unavailable." }; }
}

export async function assignResearchAuthorAction(articleId: string, expectedRevision: number, authorId: string, reason: string): Promise<ResearchActionResult> {
  try { const context = await getAuthorizationContext(); if (!rolesInclude(context.roles, ["owner", "admin"])) return { ok: false, error: "Only Owner or Admin can assign a Research author." }; const { data, error } = await context.supabase.rpc("assign_research_author", { p_article_id: articleId, p_expected_revision: expectedRevision, p_author_id: authorId, p_reason: reason }); if (error) return { ok: false, error: messageFor(error) }; const result = success(data); if (result.ok) revalidateResearch(articleId); return result; } catch { return { ok: false, error: "Research administration is temporarily unavailable." }; }
}

export async function searchResearchTokensAction(search: string): Promise<{ ok: true; tokens: Array<{ id: string; chain: string; symbol: string | null; name: string | null }> } | { ok: false; error: string }> {
  try { const context = await getAuthorizationContext(); if (!rolesInclude(context.roles, ["owner", "admin", "editor", "analyst"])) return { ok: false, error: "Token options are not available for this role." }; const { data, error } = await context.supabase.rpc("research_token_options", { p_search: search.slice(0, 200), p_limit: 50 }); if (error) return { ok: false, error: "Token options are temporarily unavailable." }; return { ok: true, tokens: Array.isArray(data) ? data.map((item) => ({ id: String(item.id), chain: String(item.chain), symbol: typeof item.symbol === "string" ? item.symbol : null, name: typeof item.name === "string" ? item.name : null })) : [] }; } catch { return { ok: false, error: "Token options are temporarily unavailable." }; }
}
