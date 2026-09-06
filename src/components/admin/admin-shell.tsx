import type { ReactNode } from "react";

import { Container } from "@/components/ui";
import type { AuthorizationContext } from "@/lib/auth/authorization";

import LogoutButton from "@/app/admin/logout-button";

import { AdminMobileNavigation, AdminNavigation } from "./admin-navigation";
import { getAdminNavigation, roleLabels } from "./navigation";

export default function AdminShell({ context, children }: { context: AuthorizationContext; children: ReactNode }) {
  const groups = getAdminNavigation(context.permissions, context.roles);
  const roles = context.roles.map((role) => roleLabels[role]).join(" · ");

  return (
    <div className="min-h-screen bg-[var(--n100-canvas)] text-[var(--n100-text-primary)]">
      <div className="flex min-h-screen">
        <aside className="hidden w-64 shrink-0 border-r border-[var(--n100-border-subtle)] bg-[var(--n100-surface-subtle)] lg:block">
          <div className="sticky top-0 flex h-screen flex-col px-5 py-6">
            <div className="border-b border-[var(--n100-border-subtle)] pb-6">
              <p className="font-mono text-[0.625rem] font-semibold uppercase tracking-[0.18em] text-[var(--n100-accent)]">NEXT100XGEMS</p>
              <p className="mt-2 text-xs text-[var(--n100-text-tertiary)]">Private operating system</p>
            </div>
            <div className="flex-1 overflow-y-auto py-7">
              <AdminNavigation groups={groups} />
            </div>
            <div className="border-t border-[var(--n100-border-subtle)] pt-5">
              <p className="text-[0.625rem] uppercase tracking-[0.16em] text-[var(--n100-text-tertiary)]">Authenticated staff</p>
              <p className="mt-2 truncate text-xs text-[var(--n100-text-secondary)]" title={roles}>{roles}</p>
              <div className="mt-4"><LogoutButton /></div>
            </div>
          </div>
        </aside>

        <div className="min-w-0 flex-1">
          <header className="relative border-b border-[var(--n100-border-subtle)] bg-[var(--n100-canvas)]">
            <Container className="flex min-h-16 items-center justify-between gap-4 py-3">
              <div className="flex items-center gap-4">
                <AdminMobileNavigation groups={groups} />
                <div>
                  <p className="text-[0.625rem] font-semibold uppercase tracking-[0.18em] text-[var(--n100-text-tertiary)]">Admin</p>
                  <p className="mt-0.5 text-sm text-[var(--n100-text-secondary)]">Operational foundation</p>
                </div>
              </div>
              <div className="flex items-center gap-3 text-right">
                <div className="hidden items-center gap-3 sm:flex">
                  <span className="size-1.5 rounded-full bg-[var(--n100-positive)]" aria-hidden="true" />
                  <span className="font-mono text-[0.625rem] uppercase tracking-[0.13em] text-[var(--n100-text-tertiary)]">Session verified</span>
                </div>
                <div className="lg:hidden"><LogoutButton /></div>
              </div>
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
