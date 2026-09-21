"use server";

import { revalidatePath } from "next/cache";

import { AuthorizationError } from "@/lib/auth/authorization";
import { isProjectFieldKey } from "@/lib/projects";
import { requireProjectAccess } from "@/lib/projects/authorization";

export type OfficialDataActionResult =
  | { ok: true }
  | { ok: false; error: string };

export async function updateProjectFieldAction(
  projectId: string,
  fieldKey: string,
  rawValue: string,
): Promise<OfficialDataActionResult> {
  try {
    if (!isProjectFieldKey(fieldKey)) {
      return { ok: false, error: "That field is not editable." };
    }
    const value = rawValue.trim();
    if (!value) {
      return { ok: false, error: "A value is required." };
    }

    const access = await requireProjectAccess(projectId, "project_editor");
    const { error } = await access.supabase.rpc("set_project_field_value", {
      p_project_id: projectId,
      p_field_key: fieldKey,
      p_value: value,
    });

    if (error) {
      return { ok: false, error: "The field could not be updated." };
    }

    revalidatePath(`/projects/${projectId}/official-data`);
    return { ok: true };
  } catch (error) {
    if (error instanceof AuthorizationError) {
      return { ok: false, error: error.message };
    }
    return { ok: false, error: "Official Data is temporarily unavailable." };
  }
}
