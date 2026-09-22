import { notFound, redirect } from "next/navigation";

import { AuthorizationError, requireIdentity } from "@/lib/auth/authorization";
import { getLoginRedirect } from "@/lib/auth/redirects";
import { isFeatureEnabled } from "@/lib/feature-flags/server";

export const dynamic = "force-dynamic";

export default async function ProjectConsoleRootLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  if (!(await isFeatureEnabled("project_console_enabled"))) {
    notFound();
  }

  try {
    await requireIdentity();
  } catch (error) {
    if (error instanceof AuthorizationError && error.status === 401) {
      redirect(getLoginRedirect("/projects"));
    }
    throw error;
  }

  return children;
}
