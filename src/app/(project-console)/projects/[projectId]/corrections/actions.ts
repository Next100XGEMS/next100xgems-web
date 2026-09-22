"use server";

import { revalidatePath } from "next/cache";

import { AuthorizationError } from "@/lib/auth/authorization";
import { isFeatureEnabled } from "@/lib/feature-flags/server";
import { isProjectFieldKey } from "@/lib/projects";
import { requireProjectAccess } from "@/lib/projects/authorization";

export type CorrectionSubmitResult =
  | { ok: true; correctionId: string }
  | { ok: false; error: string };

const FORBIDDEN_HINT =
  /forbidden|not allowlisted|intelligence|score|risk|organic|evidence/i;

export async function submitProjectCorrectionAction(input: {
  projectId: string;
  fieldKey: string;
  proposedValue: string;
  rationale: string;
}): Promise<CorrectionSubmitResult> {
  try {
    if (!(await isFeatureEnabled("project_corrections_enabled"))) {
      return { ok: false, error: "Project corrections are not available." };
    }

    const fieldKey = input.fieldKey.trim();
    const proposedValue = input.proposedValue.trim();
    const rationale = input.rationale.trim();

    if (!isProjectFieldKey(fieldKey)) {
      return {
        ok: false,
        error:
          "That field is not allowlisted. Score, risk, organic rank, and evidence keys are rejected.",
      };
    }
    if (!proposedValue) {
      return { ok: false, error: "A proposed value is required." };
    }
    if (!rationale) {
      return { ok: false, error: "A rationale is required." };
    }

    const access = await requireProjectAccess(input.projectId, "project_editor");
    const { data, error } = await access.supabase.rpc("submit_project_correction", {
      p_project_id: input.projectId,
      p_field_key: fieldKey,
      p_proposed_value: proposedValue,
      p_rationale: rationale,
    });

    if (error) {
      const message = error.message ?? "";
      if (FORBIDDEN_HINT.test(message)) {
        return {
          ok: false,
          error:
            "Correction target is forbidden or not allowlisted. Intelligence fields cannot be corrected here.",
        };
      }
      if (/not available/i.test(message)) {
        return { ok: false, error: "Project corrections are not available." };
      }
      if (/too many open corrections/i.test(message)) {
        return { ok: false, error: "You already have too many open corrections." };
      }
      return { ok: false, error: "The correction could not be submitted." };
    }

    const correctionId =
      data &&
      typeof data === "object" &&
      "correction_id" in data &&
      typeof (data as { correction_id: unknown }).correction_id === "string"
        ? (data as { correction_id: string }).correction_id
        : null;

    if (!correctionId) {
      return { ok: false, error: "The correction could not be submitted." };
    }

    revalidatePath(`/projects/${input.projectId}/corrections`);
    revalidatePath(`/projects/${input.projectId}/official-data`);
    return { ok: true, correctionId };
  } catch (error) {
    if (error instanceof AuthorizationError) {
      return { ok: false, error: error.message };
    }
    return { ok: false, error: "Project corrections are temporarily unavailable." };
  }
}
