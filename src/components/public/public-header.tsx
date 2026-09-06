"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";
import { useState } from "react";

const primaryLinks = [
  ["Radar", "/radar"],
  ["Research", "/research"],
  ["Partners", "/partners"],
  ["Advertise", "/advertise"],
  ["Network", "/network"],
] as const;

function isCurrentPath(pathname: string | null, href: string) {
  return pathname === href || pathname?.startsWith(`${href}/`);
}

function NavLink({ href, label, onNavigate }: { href: string; label: string; onNavigate?: () => void }) {
  const current = isCurrentPath(usePathname(), href);

  return (
    <Link
      href={href}
      className={current
        ? "relative text-[var(--n100-text-primary)] after:absolute after:-bottom-2 after:left-0 after:h-px after:w-full after:bg-[var(--n100-accent)]"
        : "text-[var(--n100-text-secondary)] hover:text-[var(--n100-text-primary)]"}
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
          {primaryLinks.map(([label, href]) => <NavLink key={href} href={href} label={label} />)}
        </nav>

        <Link
          href="/work-with-us"
          className={workWithUsCurrent
            ? "inline-flex min-h-9 shrink-0 items-center justify-center rounded-[var(--n100-radius-control)] border border-[var(--n100-accent)] bg-[var(--n100-accent)] px-3 text-xs font-semibold text-[#11201a]"
            : "inline-flex min-h-9 shrink-0 items-center justify-center rounded-[var(--n100-radius-control)] border border-[var(--n100-border-strong)] px-3 text-xs font-semibold text-[var(--n100-text-primary)] hover:border-[var(--n100-accent)] hover:text-[var(--n100-accent)]"}
          aria-current={workWithUsCurrent ? "page" : undefined}
        >
          Work With Us
        </Link>

        <button
          type="button"
          className="inline-flex size-9 items-center justify-center rounded-[var(--n100-radius-control)] border border-[var(--n100-border-subtle)] text-[var(--n100-text-secondary)] hover:border-[var(--n100-border-strong)] hover:text-[var(--n100-text-primary)] lg:hidden"
          aria-expanded={mobileOpen}
          aria-controls="public-mobile-navigation"
          aria-label={mobileOpen ? "Close navigation" : "Open navigation"}
          onClick={() => setMobileOpen((open) => !open)}
        >
          <span aria-hidden="true" className="font-mono text-base">{mobileOpen ? "×" : "≡"}</span>
        </button>
      </div>

      {mobileOpen ? (
        <nav id="public-mobile-navigation" className="border-t border-[var(--n100-border-subtle)] px-[var(--n100-gutter)] py-4 lg:hidden" aria-label="Mobile navigation">
          <div className="mx-auto flex w-full max-w-[var(--n100-content-max)] flex-col gap-1 text-sm font-medium">
            {primaryLinks.map(([label, href]) => <NavLink key={href} href={href} label={label} onNavigate={() => setMobileOpen(false)} />)}
            <Link
              href="/methodology"
              className="py-2 text-[var(--n100-text-secondary)] hover:text-[var(--n100-text-primary)]"
              onClick={() => setMobileOpen(false)}
            >
              Methodology
            </Link>
            <Link
              href="/disclosures"
              className="py-2 text-[var(--n100-text-secondary)] hover:text-[var(--n100-text-primary)]"
              onClick={() => setMobileOpen(false)}
            >
              Disclosures
            </Link>
            <Link
              href="/work-with-us"
              className="mt-2 inline-flex min-h-10 items-center justify-center rounded-[var(--n100-radius-control)] bg-[var(--n100-accent)] px-4 text-sm font-semibold text-[#11201a]"
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
