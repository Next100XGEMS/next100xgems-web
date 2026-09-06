import { redirect } from "next/navigation";

import AdminAccessDenied from "@/components/admin/admin-access-denied";
import AdminShell from "@/components/admin/admin-shell";
import { AuthorizationError, requireAdminAccess } from "@/lib/auth/authorization";
import { getLoginRedirect } from "@/lib/auth/redirects";

export const dynamic = "force-dynamic";

export default async function AdminLayout({ children }: { children: React.ReactNode }) {
  let context;

  try {
    context = await requireAdminAccess();
  } catch (error) {
    if (error instanceof AuthorizationError && error.status === 401) {
      redirect(getLoginRedirect("/admin"));
    }
    if (error instanceof AuthorizationError && error.status === 403) {
      return <AdminAccessDenied message="Your account is authenticated but has no active application role." />;
    }
    throw error;
  }

  return <AdminShell context={context}>{children}</AdminShell>;
}
