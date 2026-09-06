"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";
import { useState } from "react";

import type { AdminNavGroup } from "./navigation";

function isCurrentPath(pathname: string, href: string) {
  return href === "/admin" ? pathname === href : pathname === href || pathname.startsWith(`${href}/`);
}

function NavigationItems({ groups, onNavigate }: { groups: readonly AdminNavGroup[]; onNavigate?: () => void }) {
  const pathname = usePathname();

  return (
    <>
      {groups.map((group) => (
        <div key={group.label ?? "overview"} className="space-y-2">
          {group.label ? (
            <p className="px-3 text-[0.625rem] font-semibold uppercase tracking-[0.18em] text-[var(--n100-text-tertiary)]">
              {group.label}
            </p>
          ) : null}
          <div className="space-y-0.5">
            {group.items.map((item) => {
              const active = isCurrentPath(pathname, item.href);
              const classes = `group flex min-h-9 items-center justify-between gap-3 border-l-2 px-3 text-sm transition-colors ${
                active
                  ? "border-[var(--n100-accent)] bg-[var(--n100-surface-secondary)] text-[var(--n100-text-primary)]"
                  : "border-transparent text-[var(--n100-text-secondary)] hover:border-[var(--n100-border-strong)] hover:bg-[var(--n100-surface-subtle)] hover:text-[var(--n100-text-primary)]"
              }`;

              if (item.planned) {
                return (
                  <span key={item.href} className={`${classes} cursor-not-allowed opacity-55`} title="Planned for a later gate">
                    <span>{item.label}</span>
                    <span className="font-mono text-[0.625rem] uppercase tracking-[0.12em] text-[var(--n100-text-tertiary)]">Soon</span>
                  </span>
                );
              }

              return (
                <Link
                  key={item.href}
                  href={item.href}
                  className={classes}
                  aria-current={active ? "page" : undefined}
                  onClick={onNavigate}
                >
                  <span>{item.label}</span>
                  {active ? <span aria-hidden="true" className="font-mono text-[0.625rem] text-[var(--n100-accent)]">●</span> : null}
                </Link>
              );
            })}
          </div>
        </div>
      ))}
    </>
  );
}

export function AdminNavigation({ groups }: { groups: readonly AdminNavGroup[] }) {
  return (
    <nav aria-label="Admin sections" className="hidden space-y-6 lg:block">
      <NavigationItems groups={groups} />
    </nav>
  );
}

export function AdminMobileNavigation({ groups }: { groups: readonly AdminNavGroup[] }) {
  const [open, setOpen] = useState(false);

  return (
    <div className="lg:hidden">
      <button
        type="button"
        className="inline-flex min-h-9 items-center gap-2 rounded-[var(--n100-radius-control)] border border-[var(--n100-border-subtle)] px-3 text-xs font-medium text-[var(--n100-text-secondary)] hover:bg-[var(--n100-surface-secondary)] hover:text-[var(--n100-text-primary)]"
        aria-expanded={open}
        aria-controls="admin-mobile-navigation"
        onClick={() => setOpen((value) => !value)}
      >
        <span aria-hidden="true" className="font-mono text-[var(--n100-accent)]">{open ? "×" : "≡"}</span>
        Sections
      </button>
      {open ? (
        <nav id="admin-mobile-navigation" aria-label="Admin sections" className="absolute inset-x-0 top-full z-20 border-b border-[var(--n100-border-subtle)] bg-[var(--n100-canvas)] px-[var(--n100-gutter)] py-5 shadow-2xl shadow-black/20">
          <div className="grid gap-5 sm:grid-cols-2">
            <NavigationItems groups={groups} onNavigate={() => setOpen(false)} />
          </div>
        </nav>
      ) : null}
    </div>
  );
}
