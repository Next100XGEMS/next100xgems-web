"use client";

import type { ComponentPropsWithoutRef, ReactNode } from "react";

import { cx } from "./cx";

export type FilterChipProps = ComponentPropsWithoutRef<"button"> & {
  selected?: boolean;
  availabilityLabel?: string;
};

export function FilterChip({
  className,
  selected = false,
  disabled,
  availabilityLabel,
  children,
  ...props
}: FilterChipProps) {
  return (
    <button
      type="button"
      aria-pressed={selected}
      disabled={disabled}
      className={cx(
        "inline-flex min-h-9 items-center gap-1.5 rounded-[var(--n100-radius-control)] border px-2.5 text-xs font-medium transition-colors",
        selected
          ? "border-[var(--n100-accent)]/70 bg-[var(--n100-accent)]/10 text-[var(--n100-text-primary)]"
          : "border-[var(--n100-border-subtle)] bg-[var(--n100-surface-secondary)]/50 text-[var(--n100-text-secondary)] hover:border-[var(--n100-border-strong)] hover:text-[var(--n100-text-primary)]",
        disabled && "cursor-not-allowed opacity-45 hover:border-[var(--n100-border-subtle)] hover:text-[var(--n100-text-secondary)]",
        className,
      )}
      {...props}
    >
      {children}
      {availabilityLabel ? (
        <span className="font-mono text-[0.5rem] uppercase tracking-[0.12em] text-[var(--n100-warning)]">
          {availabilityLabel}
        </span>
      ) : null}
    </button>
  );
}

export function FilterGroup({
  label,
  helperText,
  children,
  className,
}: {
  label: string;
  helperText?: string;
  children: ReactNode;
  className?: string;
}) {
  return (
    <fieldset className={cx("min-w-0", className)}>
      <legend className="font-mono text-[0.55rem] font-semibold uppercase tracking-[0.16em] text-[var(--n100-text-tertiary)]">
        {label}
      </legend>
      <div className="mt-2 flex flex-wrap gap-1.5">{children}</div>
      {helperText ? <p className="mt-2 text-[0.7rem] leading-5 text-[var(--n100-text-tertiary)]">{helperText}</p> : null}
    </fieldset>
  );
}

export function FilterRail({
  children,
  className,
  title = "Filters",
  helperText,
  availabilityLabel,
}: {
  children: ReactNode;
  className?: string;
  title?: string;
  helperText?: string;
  availabilityLabel?: string;
}) {
  return (
    <aside
      className={cx(
        "flex w-full flex-col gap-5 border border-[var(--n100-border-subtle)] bg-[var(--n100-surface-subtle)] p-4 lg:w-56 lg:shrink-0",
        className,
      )}
      aria-label={title}
    >
      <div className="flex items-center justify-between gap-2">
        <p className="font-mono text-[0.625rem] font-semibold uppercase tracking-[0.16em] text-[var(--n100-text-secondary)]">
          {title}
        </p>
        {availabilityLabel ? (
          <span className="font-mono text-[0.5rem] font-semibold uppercase tracking-[0.12em] text-[var(--n100-warning)]">
            {availabilityLabel}
          </span>
        ) : null}
      </div>
      {helperText ? <p className="text-xs leading-5 text-[var(--n100-text-tertiary)]">{helperText}</p> : null}
      {children}
    </aside>
  );
}
