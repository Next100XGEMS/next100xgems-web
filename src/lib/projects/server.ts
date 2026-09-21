import "server-only";

import type { ProjectAccessContext } from "./authorization";
import {
  isProjectFieldKey,
  isProjectMemberRole,
  isProjectProvenance,
  isProjectWorkflowState,
  type Project,
  type ProjectClaim,
  type ProjectCorrection,
  type ProjectFieldKey,
  type ProjectFieldValue,
  type ProjectMember,
  type ProjectStatus,
} from "./types";

function asStatus(value: unknown): ProjectStatus | null {
  return value === "DRAFT" || value === "ACTIVE" || value === "SUSPENDED" ? value : null;
}

export function mapProjectRow(row: Record<string, unknown>): Project | null {
  const status = asStatus(row.status);
  if (
    typeof row.id !== "string" ||
    typeof row.slug !== "string" ||
    typeof row.display_name !== "string" ||
    !status ||
    typeof row.created_at !== "string" ||
    typeof row.updated_at !== "string"
  ) {
    return null;
  }
  return {
    id: row.id,
    slug: row.slug,
    displayName: row.display_name,
    status,
    createdAt: row.created_at,
    updatedAt: row.updated_at,
  };
}

export async function getProjectForMember(
  context: ProjectAccessContext,
): Promise<Project | null> {
  const { data, error } = await context.supabase
    .from("projects")
    .select("id, slug, display_name, status, created_at, updated_at")
    .eq("id", context.projectId)
    .maybeSingle();

  if (error || !data) return null;
  return mapProjectRow(data as Record<string, unknown>);
}

export async function listProjectMembers(
  context: ProjectAccessContext,
): Promise<ProjectMember[]> {
  const { data, error } = await context.supabase
    .from("project_members")
    .select("id, project_id, user_id, role, created_at, updated_at")
    .eq("project_id", context.projectId)
    .order("created_at", { ascending: true });

  if (error || !Array.isArray(data)) return [];

  return data.flatMap((row) => {
    const record = row as Record<string, unknown>;
    if (
      typeof record.id !== "string" ||
      typeof record.project_id !== "string" ||
      typeof record.user_id !== "string" ||
      !isProjectMemberRole(record.role) ||
      typeof record.created_at !== "string" ||
      typeof record.updated_at !== "string"
    ) {
      return [];
    }
    return [
      {
        id: record.id,
        projectId: record.project_id,
        userId: record.user_id,
        role: record.role,
        createdAt: record.created_at,
        updatedAt: record.updated_at,
      },
    ];
  });
}

export async function listProjectFieldValues(
  context: ProjectAccessContext,
): Promise<ProjectFieldValue[]> {
  const { data, error } = await context.supabase
    .from("project_field_values")
    .select("id, project_id, field_key, value, provenance, version, updated_by, updated_at")
    .eq("project_id", context.projectId)
    .order("field_key", { ascending: true });

  if (error || !Array.isArray(data)) return [];

  return data.flatMap((row) => {
    const record = row as Record<string, unknown>;
    if (
      typeof record.id !== "string" ||
      typeof record.project_id !== "string" ||
      !isProjectFieldKey(record.field_key) ||
      !isProjectProvenance(record.provenance) ||
      typeof record.version !== "number" ||
      typeof record.updated_at !== "string"
    ) {
      return [];
    }
    return [
      {
        id: record.id,
        projectId: record.project_id,
        fieldKey: record.field_key as ProjectFieldKey,
        value: record.value,
        provenance: record.provenance,
        version: record.version,
        updatedBy: typeof record.updated_by === "string" ? record.updated_by : null,
        updatedAt: record.updated_at,
      },
    ];
  });
}

export async function listOpenProjectClaims(supabase: ProjectAccessContext["supabase"]) {
  const { data, error } = await supabase
    .from("project_claims")
    .select(
      "id, project_id, claimant_user_id, proposed_slug, proposed_display_name, payload, state, reviewer_user_id, review_note, submitted_at, reviewed_at",
    )
    .in("state", ["SUBMITTED", "UNDER_REVIEW"])
    .order("submitted_at", { ascending: true });

  if (error || !Array.isArray(data)) return [] as ProjectClaim[];

  return data.flatMap((row) => {
    const record = row as Record<string, unknown>;
    if (
      typeof record.id !== "string" ||
      typeof record.claimant_user_id !== "string" ||
      typeof record.proposed_slug !== "string" ||
      typeof record.proposed_display_name !== "string" ||
      !isProjectWorkflowState(record.state) ||
      typeof record.submitted_at !== "string"
    ) {
      return [];
    }
    return [
      {
        id: record.id,
        projectId: typeof record.project_id === "string" ? record.project_id : null,
        claimantUserId: record.claimant_user_id,
        proposedSlug: record.proposed_slug,
        proposedDisplayName: record.proposed_display_name,
        payload:
          record.payload && typeof record.payload === "object" && !Array.isArray(record.payload)
            ? (record.payload as Record<string, unknown>)
            : {},
        state: record.state,
        reviewerUserId: typeof record.reviewer_user_id === "string" ? record.reviewer_user_id : null,
        reviewNote: typeof record.review_note === "string" ? record.review_note : null,
        submittedAt: record.submitted_at,
        reviewedAt: typeof record.reviewed_at === "string" ? record.reviewed_at : null,
      },
    ];
  });
}

export async function listOpenProjectCorrections(supabase: ProjectAccessContext["supabase"]) {
  const { data, error } = await supabase
    .from("project_corrections")
    .select(
      "id, project_id, submitter_user_id, field_key, proposed_value, rationale, state, reviewer_user_id, review_note, submitted_at, reviewed_at",
    )
    .in("state", ["SUBMITTED", "UNDER_REVIEW"])
    .order("submitted_at", { ascending: true });

  if (error || !Array.isArray(data)) return [] as ProjectCorrection[];

  return data.flatMap((row) => {
    const record = row as Record<string, unknown>;
    if (
      typeof record.id !== "string" ||
      typeof record.project_id !== "string" ||
      typeof record.submitter_user_id !== "string" ||
      typeof record.field_key !== "string" ||
      typeof record.rationale !== "string" ||
      !isProjectWorkflowState(record.state) ||
      typeof record.submitted_at !== "string"
    ) {
      return [];
    }
    return [
      {
        id: record.id,
        projectId: record.project_id,
        submitterUserId: record.submitter_user_id,
        fieldKey: record.field_key,
        proposedValue: record.proposed_value,
        rationale: record.rationale,
        state: record.state,
        reviewerUserId: typeof record.reviewer_user_id === "string" ? record.reviewer_user_id : null,
        reviewNote: typeof record.review_note === "string" ? record.review_note : null,
        submittedAt: record.submitted_at,
        reviewedAt: typeof record.reviewed_at === "string" ? record.reviewed_at : null,
      },
    ];
  });
}
