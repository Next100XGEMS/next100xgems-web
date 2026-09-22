"use server";

import { revalidatePath } from "next/cache";

import { requireAdminAccess } from "@/lib/auth/authorization";

export type ClaimReviewResult = { ok: true } | { ok: false; error: string };

async function asStaff() {
  const context = await requireAdminAccess();
  if (!context.roles.some((role) => role === "owner" || role === "admin")) {
    return null;
  }
  return context;
}

export async function startProjectClaimReviewAction(claimId: string): Promise<ClaimReviewResult> {
  try {
    const context = await asStaff();
    if (!context) return { ok: false, error: "Only Owner or Admin can review claims." };
    const { error } = await context.supabase.rpc("review_project_claim_start", {
      p_claim_id: claimId,
    });
    if (error) return { ok: false, error: "Claim could not enter review." };
    revalidatePath("/admin/project-claims");
    return { ok: true };
  } catch {
    return { ok: false, error: "Claim review is temporarily unavailable." };
  }
}

export async function approveProjectClaimAction(
  claimId: string,
  reviewNote: string,
): Promise<ClaimReviewResult> {
  try {
    const context = await asStaff();
    if (!context) return { ok: false, error: "Only Owner or Admin can approve claims." };
    const { error } = await context.supabase.rpc("review_project_claim_approve", {
      p_claim_id: claimId,
      p_review_note: reviewNote.trim() || null,
    });
    if (error) return { ok: false, error: "Claim could not be approved." };
    revalidatePath("/admin/project-claims");
    return { ok: true };
  } catch {
    return { ok: false, error: "Claim review is temporarily unavailable." };
  }
}

export async function rejectProjectClaimAction(
  claimId: string,
  reviewNote: string,
): Promise<ClaimReviewResult> {
  try {
    const context = await asStaff();
    if (!context) return { ok: false, error: "Only Owner or Admin can reject claims." };
    if (!reviewNote.trim()) return { ok: false, error: "A rejection note is required." };
    const { error } = await context.supabase.rpc("review_project_claim_reject", {
      p_claim_id: claimId,
      p_review_note: reviewNote.trim(),
    });
    if (error) return { ok: false, error: "Claim could not be rejected." };
    revalidatePath("/admin/project-claims");
    return { ok: true };
  } catch {
    return { ok: false, error: "Claim review is temporarily unavailable." };
  }
}
