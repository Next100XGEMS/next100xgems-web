import type { ReactNode } from "react";

import { Container } from "@/components/ui";
import type { Project, ProjectMemberRole } from "@/lib/projects/types";

import { getProjectConsoleNav } from "./navigation";
import { ProjectConsoleMobileNav, ProjectConsoleNav } from "./project-console-nav";

const roleLabels: Record<ProjectMemberRole, string> = {
  project_owner: "Project owner",
  project_editor: "Project editor",
  project_viewer: "Project viewer",
};

export default function ProjectConsoleShell({
  project,
  role,
  children,
}: {
  project: Project;
  role: ProjectMemberRole;
  children: ReactNode;
}) {
  const items = getProjectConsoleNav(project.id);

  return (
    <div className="min-h-screen bg-[var(--n100-canvas)] text-[var(--n100-text-primary)]">
      <div className="flex min-h-screen">
        <aside className="hidden w-64 shrink-0 border-r border-[var(--n100-border-subtle)] bg-[var(--n100-surface-subtle)] lg:block">
          <div className="sticky top-0 flex h-screen flex-col px-5 py-6">
            <div className="border-b border-[var(--n100-border-subtle)] pb-6">
              <p className="font-mono text-[0.625rem] font-semibold uppercase tracking-[0.18em] text-[var(--n100-accent)]">
                Project Console
              </p>
              <p className="mt-2 truncate text-sm font-medium text-[var(--n100-text-primary)]" title={project.displayName}>
                {project.displayName}
              </p>
              <p className="mt-1 font-mono text-[0.625rem] uppercase tracking-[0.14em] text-[var(--n100-text-tertiary)]">
                {project.slug} · {project.status}
              </p>
            </div>
            <div className="flex-1 overflow-y-auto py-7">
              <ProjectConsoleNav items={items} />
            </div>
            <div className="border-t border-[var(--n100-border-subtle)] pt-5">
              <p className="text-[0.625rem] uppercase tracking-[0.16em] text-[var(--n100-text-tertiary)]">Membership</p>
              <p className="mt-2 text-xs text-[var(--n100-text-secondary)]">{roleLabels[role]}</p>
            </div>
          </div>
        </aside>

        <div className="min-w-0 flex-1">
          <header className="border-b border-[var(--n100-border-subtle)] bg-[var(--n100-canvas)]">
            <Container className="space-y-4 py-4">
              <div>
                <p className="text-[0.625rem] font-semibold uppercase tracking-[0.18em] text-[var(--n100-text-tertiary)]">
                  Project Console
                </p>
                <p className="mt-0.5 text-sm text-[var(--n100-text-secondary)]">{project.displayName}</p>
              </div>
              <ProjectConsoleMobileNav items={items} />
            </Container>
          </header>
          <main className="py-10 sm:py-14">
            <Container size="wide">{children}</Container>
          </main>
        </div>
      </div>
    </div>
  );
}
