import { redirect } from "next/navigation";

import {
  AuthorizationError,
  requireAnyPermission,
  requireAdminAccess,
  type AuthorizationContext,
  type Permission,
} from "@/lib/auth/authorization";
import { getLoginRedirect } from "@/lib/auth/redirects";

export async function getAdminPageAccess(permissions: readonly Permission[], path: string): Promise<AuthorizationContext | null> {
  try {
    return permissions.length > 0 ? await requireAnyPermission(permissions) : await requireAdminAccess();
  } catch (error) {
    if (error instanceof AuthorizationError && error.status === 401) {
      redirect(getLoginRedirect(path));
    }
    if (error instanceof AuthorizationError && error.status === 403) {
      return null;
    }
    throw error;
  }
}
