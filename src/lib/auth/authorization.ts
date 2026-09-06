import { createClient } from "@/lib/supabase/server";

export const ROLE_KEYS = [
  "owner",
  "admin",
  "editor",
  "radar_reviewer",
  "ad_manager",
  "analyst",
  "viewer",
] as const;

export type RoleKey = (typeof ROLE_KEYS)[number];
export type Permission =
  | "admin.enter"
  | "profile.read.self"
  | "identity.read.directory"
  | "configuration.read"
  | "research.read.all"
  | "research.read.own_draft"
  | "research.read.published"
  | "partners.read.all"
  | "partners.read.active"
  | "commercial.read"
  | "leads.read"
  | "radar.read.analysis"
  | "radar.read.review";

const ROLE_PERMISSIONS: Record<RoleKey, readonly Permission[]> = {
  owner: [
    "admin.enter",
    "profile.read.self",
    "identity.read.directory",
    "configuration.read",
    "research.read.all",
    "partners.read.all",
    "commercial.read",
    "leads.read",
    "radar.read.analysis",
    "radar.read.review",
  ],
  admin: [
    "admin.enter",
    "profile.read.self",
    "identity.read.directory",
    "configuration.read",
    "research.read.all",
    "partners.read.all",
    "commercial.read",
    "leads.read",
    "radar.read.analysis",
    "radar.read.review",
  ],
  editor: ["admin.enter", "profile.read.self", "research.read.all"],
  radar_reviewer: [
    "admin.enter",
    "profile.read.self",
    "radar.read.analysis",
    "radar.read.review",
  ],
  ad_manager: [
    "admin.enter",
    "profile.read.self",
    "partners.read.all",
    "commercial.read",
    "leads.read",
  ],
  analyst: [
    "admin.enter",
    "profile.read.self",
    "research.read.own_draft",
    "research.read.published",
    "radar.read.analysis",
  ],
  viewer: [
    "admin.enter",
    "profile.read.self",
    "research.read.published",
    "partners.read.active",
  ],
};

export class AuthorizationError extends Error {
  constructor(
    public readonly status: 401 | 403 | 503,
    message: string,
  ) {
    super(message);
    this.name = "AuthorizationError";
  }
}

export type AuthorizationContext = {
  userId: string;
  roles: RoleKey[];
  permissions: Permission[];
  supabase: Awaited<ReturnType<typeof createClient>>;
};

function isRoleKey(value: unknown): value is RoleKey {
  return typeof value === "string" && (ROLE_KEYS as readonly string[]).includes(value);
}

function permissionsForRoles(roles: readonly RoleKey[]) {
  return [...new Set(roles.flatMap((role) => ROLE_PERMISSIONS[role]))];
}

export function isAuthorizationError(error: unknown, status?: AuthorizationError["status"]) {
  return error instanceof AuthorizationError && (status === undefined || error.status === status);
}

export async function requireIdentity() {
  const supabase = await createClient();
  const { data, error } = await supabase.auth.getClaims();
  const userId = data?.claims?.sub;

  if (error || typeof userId !== "string" || userId.length === 0) {
    throw new AuthorizationError(401, "Authentication is required.");
  }

  return { supabase, userId };
}

export async function getAuthorizationContext(): Promise<AuthorizationContext> {
  const { supabase, userId } = await requireIdentity();
  const { data, error } = await supabase.rpc("get_my_authorization");

  if (error || !Array.isArray(data) || data.length !== 1) {
    throw new AuthorizationError(503, "Authorization is temporarily unavailable.");
  }

  const row = data[0] as { user_id?: unknown; role_keys?: unknown };
  const roles = Array.isArray(row.role_keys)
    ? [...new Set(row.role_keys.filter(isRoleKey))]
    : null;

  if (row.user_id !== userId || roles === null || roles.length !== (row.role_keys as unknown[]).length) {
    throw new AuthorizationError(503, "Authorization is temporarily unavailable.");
  }

  return {
    userId,
    roles,
    permissions: permissionsForRoles(roles),
    supabase,
  };
}

export async function requireAdminAccess() {
  const context = await getAuthorizationContext();
  if (context.roles.length === 0) {
    throw new AuthorizationError(403, "You do not have access to this area.");
  }
  return context;
}

export async function requirePermission(permission: Permission) {
  const context = await getAuthorizationContext();
  if (!context.permissions.includes(permission)) {
    throw new AuthorizationError(403, "You do not have permission for this operation.");
  }
  return context;
}

export async function requireAnyPermission(permissions: readonly Permission[]) {
  const context = await getAuthorizationContext();
  if (!permissions.some((permission) => context.permissions.includes(permission))) {
    throw new AuthorizationError(403, "You do not have permission for this operation.");
  }
  return context;
}
