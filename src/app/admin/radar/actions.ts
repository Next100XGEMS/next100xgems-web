"use server";

import { revalidatePath } from "next/cache";
import { getAuthorizationContext, type RoleKey } from "@/lib/auth/authorization";
import { sha256 } from "@/lib/radar/hash";

export type RadarActionResult = { ok: true } | { ok: false; error: string };
const reviewers: readonly RoleKey[] = ["owner", "admin", "radar_reviewer"];
const processors: readonly RoleKey[] = [...reviewers, "analyst"];
function hasRole(roles: readonly RoleKey[], accepted: readonly RoleKey[]) { return roles.some((role) => accepted.includes(role)); }
function errorMessage(error: { code?: string | null } | null) { switch (error?.code) { case "40001": return "This Radar record changed. Refresh before trying again."; case "42501": return "You are not authorized for this Radar operation."; case "55000": return "This Radar operation is not available in the current state."; case "22023": case "23514": return "Check the provided Radar operation details."; default: return "The Radar operation could not be completed."; } }
function revalidateRadar() { revalidatePath("/admin/radar"); revalidatePath("/radar"); revalidatePath("/radar-preview"); }
function bounded(value: string, max: number) { return value.trim().slice(0, max); }

export async function approveRadarReview(reviewId: string, revision: number, publicNote: string, disclosure: string): Promise<RadarActionResult> {
  try { const context = await getAuthorizationContext(); if (!hasRole(context.roles, reviewers)) return { ok: false, error: "You are not authorized to approve Radar reviews." }; const { error } = await context.supabase.rpc("radar_approve_review", { p_review_id: reviewId, p_expected_revision: revision, p_public_note: bounded(publicNote, 2000), p_public_disclosure: bounded(disclosure, 2000), p_action_key: `approve:${reviewId}:${revision}` }); if (error) return { ok: false, error: errorMessage(error) }; revalidateRadar(); return { ok: true }; } catch { return { ok: false, error: "Radar administration is temporarily unavailable." }; }
}
export async function publishRadarReview(reviewId: string, revision: number): Promise<RadarActionResult> {
  try { const context = await getAuthorizationContext(); if (!hasRole(context.roles, reviewers)) return { ok: false, error: "You are not authorized to publish Radar reviews." }; const { error } = await context.supabase.rpc("radar_publish_review", { p_review_id: reviewId, p_expected_revision: revision, p_action_key: `publish:${reviewId}:${revision}` }); if (error) return { ok: false, error: errorMessage(error) }; revalidateRadar(); return { ok: true }; } catch { return { ok: false, error: "Radar administration is temporarily unavailable." }; }
}
export async function rejectRadarReview(reviewId: string, revision: number, reason: string): Promise<RadarActionResult> {
  try { const context = await getAuthorizationContext(); if (!hasRole(context.roles, reviewers)) return { ok: false, error: "You are not authorized to reject Radar reviews." }; const { error } = await context.supabase.rpc("radar_reject_review", { p_review_id: reviewId, p_expected_revision: revision, p_reason: bounded(reason, 1000), p_action_key: `reject:${reviewId}:${revision}` }); if (error) return { ok: false, error: errorMessage(error) }; revalidateRadar(); return { ok: true }; } catch { return { ok: false, error: "Radar administration is temporarily unavailable." }; }
}
export async function hideRadarReview(reviewId: string, revision: number, reason: string): Promise<RadarActionResult> {
  try { const context = await getAuthorizationContext(); if (!hasRole(context.roles, reviewers)) return { ok: false, error: "You are not authorized to hide Radar reviews." }; const { error } = await context.supabase.rpc("radar_hide_review", { p_review_id: reviewId, p_expected_revision: revision, p_reason: bounded(reason, 1000), p_action_key: `hide:${reviewId}:${revision}` }); if (error) return { ok: false, error: errorMessage(error) }; revalidateRadar(); return { ok: true }; } catch { return { ok: false, error: "Radar administration is temporarily unavailable." }; }
}
export async function updateRadarEditorialNote(reviewId: string, revision: number, note: string): Promise<RadarActionResult> {
  try { const context = await getAuthorizationContext(); if (!hasRole(context.roles, reviewers)) return { ok: false, error: "You are not authorized to edit Radar notes." }; const { error } = await context.supabase.rpc("radar_update_editorial_note", { p_review_id: reviewId, p_expected_revision: revision, p_editorial_note: bounded(note, 4000), p_action_key: `note:${reviewId}:${revision}` }); if (error) return { ok: false, error: errorMessage(error) }; revalidateRadar(); return { ok: true }; } catch { return { ok: false, error: "Radar administration is temporarily unavailable." }; }
}
export async function requestRadarReanalysis(analysisId: string, reason: string): Promise<RadarActionResult> {
  try { const context = await getAuthorizationContext(); if (!hasRole(context.roles, processors)) return { ok: false, error: "You are not authorized to request Radar reanalysis." }; const safeReason = bounded(reason, 1000); const key = `reanalysis:${analysisId}:${sha256({ analysisId, reason: safeReason })}`; const { error } = await context.supabase.rpc("radar_request_reanalysis", { p_analysis_id: analysisId, p_reason: safeReason, p_request_key: key }); if (error) return { ok: false, error: errorMessage(error) }; revalidateRadar(); return { ok: true }; } catch { return { ok: false, error: "Radar administration is temporarily unavailable." }; }
}
export async function requestRadarScoreRecalculation(analysisId: string, reason: string): Promise<RadarActionResult> {
  try { const context = await getAuthorizationContext(); if (!hasRole(context.roles, processors)) return { ok: false, error: "You are not authorized to request Radar score recalculation." }; const safeReason = bounded(reason, 1000); const key = `recalculation:${analysisId}:${sha256({ analysisId, reason: safeReason })}`; const { error } = await context.supabase.rpc("radar_request_score_recalculation", { p_analysis_id: analysisId, p_reason: safeReason, p_request_key: key }); if (error) return { ok: false, error: errorMessage(error) }; revalidateRadar(); return { ok: true }; } catch { return { ok: false, error: "Radar administration is temporarily unavailable." }; }
}
