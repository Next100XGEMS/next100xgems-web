"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";

import type { ProjectConsoleNavItem } from "./navigation";

function cx(...values: Array<string | false | undefined>) {
  return values.filter(Boolean).join(" ");
}

export function ProjectConsoleNav({ items }: { items: readonly ProjectConsoleNavItem[] }) {
  const pathname = usePathname();

  return (
    <nav aria-label="Project console" className="space-y-0.5">
      {items.map((item) => {
        const active =
          item.segment === ""
            ? pathname === item.href
            : pathname === item.href || pathname.startsWith(`${item.href}/`);
        return (
          <Link
            key={item.href}
            href={item.href}
            className={cx(
              "block min-h-11 rounded-[var(--n100-radius-control)] px-3 py-2.5 text-sm transition-colors",
              active
                ? "border-l-2 border-[var(--n100-accent)] bg-[var(--n100-surface-elevated)] font-medium text-[var(--n100-text-primary)]"
                : "border-l-2 border-transparent text-[var(--n100-text-secondary)] hover:bg-[var(--n100-surface-subtle)] hover:text-[var(--n100-text-primary)]",
            )}
            aria-current={active ? "page" : undefined}
          >
            {item.label}
          </Link>
        );
      })}
    </nav>
  );
}

export function ProjectConsoleMobileNav({ items }: { items: readonly ProjectConsoleNavItem[] }) {
  const pathname = usePathname();

  return (
    <nav aria-label="Project console sections" className="flex gap-2 overflow-x-auto pb-1 lg:hidden">
      {items.map((item) => {
        const active =
          item.segment === ""
            ? pathname === item.href
            : pathname === item.href || pathname.startsWith(`${item.href}/`);
        return (
          <Link
            key={item.href}
            href={item.href}
            className={cx(
              "inline-flex min-h-11 shrink-0 items-center rounded-[var(--n100-radius-control)] border px-3 text-xs font-medium tracking-wide",
              active
                ? "border-[var(--n100-accent)]/40 bg-[var(--n100-accent)]/10 text-[var(--n100-text-primary)]"
                : "border-[var(--n100-border-subtle)] text-[var(--n100-text-secondary)]",
            )}
            aria-current={active ? "page" : undefined}
          >
            {item.label}
          </Link>
        );
      })}
    </nav>
  );
}
