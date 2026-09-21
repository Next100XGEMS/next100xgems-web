"use server";

import { revalidatePath } from "next/cache";

import { requireAdminAccess } from "@/lib/auth/authorization";

export type CorrectionReviewResult = { ok: true } | { ok: false; error: string };

async function asStaff() {
  const context = await requireAdminAccess();
  if (!context.roles.some((role) => role === "owner" || role === "admin")) {
    return null;
  }
  return context;
}

export async function startProjectCorrectionReviewAction(
  correctionId: string,
): Promise<CorrectionReviewResult> {
  try {
    const context = await asStaff();
    if (!context) return { ok: false, error: "Only Owner or Admin can review corrections." };
    const { error } = await context.supabase.rpc("review_project_correction_start", {
      p_correction_id: correctionId,
    });
    if (error) return { ok: false, error: "Correction could not enter review." };
    revalidatePath("/admin/project-corrections");
    return { ok: true };
  } catch {
    return { ok: false, error: "Correction review is temporarily unavailable." };
  }
}

export async function approveProjectCorrectionAction(
  correctionId: string,
  reviewNote: string,
): Promise<CorrectionReviewResult> {
  try {
    const context = await asStaff();
    if (!context) return { ok: false, error: "Only Owner or Admin can approve corrections." };
    const { error } = await context.supabase.rpc("review_project_correction_approve", {
      p_correction_id: correctionId,
      p_review_note: reviewNote.trim() || null,
    });
    if (error) return { ok: false, error: "Correction could not be approved." };
    revalidatePath("/admin/project-corrections");
    return { ok: true };
  } catch {
    return { ok: false, error: "Correction review is temporarily unavailable." };
  }
}

export async function rejectProjectCorrectionAction(
  correctionId: string,
  reviewNote: string,
): Promise<CorrectionReviewResult> {
  try {
    const context = await asStaff();
    if (!context) return { ok: false, error: "Only Owner or Admin can reject corrections." };
    if (!reviewNote.trim()) return { ok: false, error: "A rejection note is required." };
    const { error } = await context.supabase.rpc("review_project_correction_reject", {
      p_correction_id: correctionId,
      p_review_note: reviewNote.trim(),
    });
    if (error) return { ok: false, error: "Correction could not be rejected." };
    revalidatePath("/admin/project-corrections");
    return { ok: true };
  } catch {
    return { ok: false, error: "Correction review is temporarily unavailable." };
  }
}
