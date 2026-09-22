"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";
import { useState } from "react";

const primaryLinks = [
  ["Radar", "/radar"],
  ["Finder", "/finder"],
  ["Research", "/research"],
  ["Partners", "/partners"],
  ["Advertise", "/advertise"],
  ["Network", "/network"],
] as const;

const trustLinks = [
  ["Methodology", "/methodology"],
  ["Disclosures", "/disclosures"],
] as const;

function isCurrentPath(pathname: string | null, href: string) {
  return pathname === href || pathname?.startsWith(`${href}/`);
}

function NavLink({
  href,
  label,
  onNavigate,
  subtle = false,
  touchTarget = false,
}: {
  href: string;
  label: string;
  onNavigate?: () => void;
  subtle?: boolean;
  /** ≥44px min height for mobile drawer / touch surfaces */
  touchTarget?: boolean;
}) {
  const current = isCurrentPath(usePathname(), href);
  const tone = current
    ? "relative text-[var(--n100-text-primary)] after:absolute after:-bottom-2 after:left-0 after:h-px after:w-full after:bg-[var(--n100-accent)]"
    : subtle
      ? "text-[var(--n100-text-tertiary)] hover:text-[var(--n100-text-primary)]"
      : "text-[var(--n100-text-secondary)] hover:text-[var(--n100-text-primary)]";
  const touch = touchTarget ? "inline-flex min-h-11 items-center py-2" : "";

  return (
    <Link
      href={href}
      className={[tone, touch].filter(Boolean).join(" ")}
      aria-current={current ? "page" : undefined}
      onClick={onNavigate}
    >
      {label}
    </Link>
  );
}

export default function PublicHeader() {
  const pathname = usePathname();
  const [mobileOpen, setMobileOpen] = useState(false);
  const workWithUsCurrent = isCurrentPath(pathname, "/work-with-us");

  return (
    <header className="sticky top-0 z-40 border-b border-[var(--n100-border-subtle)]/90 bg-[var(--n100-canvas)]/95">
      <div className="mx-auto flex min-h-16 w-full max-w-[var(--n100-content-max)] items-center gap-3 px-[var(--n100-gutter)]">
        <Link
          href="/"
          className="mr-auto shrink-0 font-mono text-[0.7rem] font-semibold tracking-[0.16em] text-[var(--n100-text-primary)] hover:text-[var(--n100-accent)]"
          aria-label="NEXT100XGEMS home"
        >
          NEXT100XGEMS
        </Link>

        <nav className="hidden items-center gap-5 text-xs font-medium lg:flex" aria-label="Primary navigation">
          {primaryLinks.map(([label, href]) => (
            <NavLink key={href} href={href} label={label} />
          ))}
          <span aria-hidden="true" className="mx-1 h-3 w-px bg-[var(--n100-border-strong)]/70" />
          {trustLinks.map(([label, href]) => (
            <NavLink key={href} href={href} label={label} subtle />
          ))}
        </nav>

        <Link
          href="/work-with-us"
          className={
            workWithUsCurrent
              ? "inline-flex min-h-11 shrink-0 items-center justify-center rounded-[var(--n100-radius-control)] border border-[var(--n100-accent)] bg-[var(--n100-accent)] px-3 text-xs font-semibold text-[var(--n100-accent-ink)]"
              : "inline-flex min-h-11 shrink-0 items-center justify-center rounded-[var(--n100-radius-control)] border border-[var(--n100-border-strong)] px-3 text-xs font-semibold text-[var(--n100-text-primary)] hover:border-[var(--n100-accent)] hover:text-[var(--n100-accent)]"
          }
          aria-current={workWithUsCurrent ? "page" : undefined}
        >
          Work With Us
        </Link>

        <button
          type="button"
          className="inline-flex size-11 items-center justify-center rounded-[var(--n100-radius-control)] border border-[var(--n100-border-subtle)] text-[var(--n100-text-secondary)] hover:border-[var(--n100-border-strong)] hover:text-[var(--n100-text-primary)] lg:hidden"
          aria-expanded={mobileOpen}
          aria-controls="public-mobile-navigation"
          aria-label={mobileOpen ? "Close navigation" : "Open navigation"}
          onClick={() => setMobileOpen((open) => !open)}
        >
          <span aria-hidden="true" className="font-mono text-base">
            {mobileOpen ? "×" : "≡"}
          </span>
        </button>
      </div>

      {mobileOpen ? (
        <nav
          id="public-mobile-navigation"
          className="border-t border-[var(--n100-border-subtle)] px-[var(--n100-gutter)] py-4 lg:hidden"
          aria-label="Mobile navigation"
        >
          <div className="mx-auto flex w-full max-w-[var(--n100-content-max)] flex-col gap-1 text-sm font-medium">
            {primaryLinks.map(([label, href]) => (
              <NavLink
                key={href}
                href={href}
                label={label}
                touchTarget
                onNavigate={() => setMobileOpen(false)}
              />
            ))}
            <p className="mt-3 font-mono text-[0.625rem] uppercase tracking-[0.16em] text-[var(--n100-text-tertiary)]">
              Trust
            </p>
            {trustLinks.map(([label, href]) => (
              <Link
                key={href}
                href={href}
                className="min-h-11 py-2 text-[var(--n100-text-secondary)] hover:text-[var(--n100-text-primary)]"
                onClick={() => setMobileOpen(false)}
              >
                {label}
              </Link>
            ))}
            <Link
              href="/work-with-us"
              className="mt-2 inline-flex min-h-11 items-center justify-center rounded-[var(--n100-radius-control)] bg-[var(--n100-accent)] px-4 text-sm font-semibold text-[var(--n100-accent-ink)]"
              aria-current={workWithUsCurrent ? "page" : undefined}
              onClick={() => setMobileOpen(false)}
            >
              Work With Us
            </Link>
          </div>
        </nav>
      ) : null}
    </header>
  );
}
