import "server-only";

import {
  AuthorizationError,
  requireIdentity,
  type AuthorizationContext,
} from "@/lib/auth/authorization";

import {
  isProjectMemberRole,
  type ProjectMemberRole,
} from "./types";

const ROLE_RANK: Record<ProjectMemberRole, number> = {
  project_viewer: 1,
  project_editor: 2,
  project_owner: 3,
};

export type ProjectAccessContext = {
  userId: string;
  projectId: string;
  role: ProjectMemberRole;
  supabase: AuthorizationContext["supabase"];
};

function rolesAtOrAbove(minRole: ProjectMemberRole): ProjectMemberRole[] {
  const minimum = ROLE_RANK[minRole];
  return PROJECT_MEMBER_ROLES_ORDERED.filter((role) => ROLE_RANK[role] >= minimum);
}

const PROJECT_MEMBER_ROLES_ORDERED: ProjectMemberRole[] = [
  "project_viewer",
  "project_editor",
  "project_owner",
];

/**
 * Bounded project-console access. Staff Admin roles do NOT satisfy this helper —
 * project_owner is orthogonal to platform owner/admin.
 */
export async function requireProjectAccess(
  projectId: string,
  minRole: ProjectMemberRole = "project_viewer",
): Promise<ProjectAccessContext> {
  if (typeof projectId !== "string" || projectId.length === 0) {
    throw new AuthorizationError(403, "You do not have access to this project.");
  }

  const { supabase, userId } = await requireIdentity();
  const { data, error } = await supabase
    .from("project_members")
    .select("role")
    .eq("project_id", projectId)
    .eq("user_id", userId)
    .maybeSingle();

  if (error) {
    throw new AuthorizationError(503, "Project authorization is temporarily unavailable.");
  }

  if (!data || !isProjectMemberRole(data.role)) {
    throw new AuthorizationError(403, "You do not have access to this project.");
  }

  const allowed = rolesAtOrAbove(minRole);
  if (!allowed.includes(data.role)) {
    throw new AuthorizationError(403, "You do not have permission for this project operation.");
  }

  return {
    userId,
    projectId,
    role: data.role,
    supabase,
  };
}

export function projectRoleSatisfies(
  role: ProjectMemberRole,
  minRole: ProjectMemberRole,
): boolean {
  return ROLE_RANK[role] >= ROLE_RANK[minRole];
}
