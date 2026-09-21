import { notFound, redirect } from "next/navigation";

import ProjectConsoleShell from "@/components/project-console/project-console-shell";
import { AuthorizationError } from "@/lib/auth/authorization";
import { getLoginRedirect } from "@/lib/auth/redirects";
import { requireProjectAccess } from "@/lib/projects/authorization";
import { getProjectForMember } from "@/lib/projects/server";

export default async function ProjectConsoleProjectLayout({
  children,
  params,
}: {
  children: React.ReactNode;
  params: Promise<{ projectId: string }>;
}) {
  const { projectId } = await params;
  let access;

  try {
    access = await requireProjectAccess(projectId, "project_viewer");
  } catch (error) {
    if (error instanceof AuthorizationError && error.status === 401) {
      redirect(getLoginRedirect(`/projects/${projectId}`));
    }
    if (error instanceof AuthorizationError && error.status === 403) {
      notFound();
    }
    throw error;
  }

  const project = await getProjectForMember(access);
  if (!project) {
    notFound();
  }

  return (
    <ProjectConsoleShell project={project} role={access.role}>
      {children}
    </ProjectConsoleShell>
  );
}
