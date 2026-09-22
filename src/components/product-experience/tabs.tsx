"use client";

import type { ReactNode } from "react";

import { cx } from "./cx";

export type TabItem = {
  id: string;
  label: string;
  disabled?: boolean;
  badge?: string;
};

export type TabsProps = {
  items: readonly TabItem[];
  value: string;
  onChange?: (id: string) => void;
  className?: string;
  "aria-label"?: string;
};

export function Tabs({ items, value, onChange, className, "aria-label": ariaLabel = "Tabs" }: TabsProps) {
  return (
    <div
      role="tablist"
      aria-label={ariaLabel}
      className={cx("flex flex-wrap gap-1 border-b border-[var(--n100-border-subtle)]", className)}
    >
      {items.map((item) => {
        const selected = item.id === value;
        return (
          <button
            key={item.id}
            type="button"
            role="tab"
            id={`tab-${item.id}`}
            aria-selected={selected}
            aria-controls={`tabpanel-${item.id}`}
            disabled={item.disabled}
            className={cx(
              "inline-flex min-h-9 items-center gap-2 border-b-2 px-3 text-xs font-medium tracking-[-0.01em] transition-colors",
              selected
                ? "border-[var(--n100-accent)] text-[var(--n100-text-primary)]"
                : "border-transparent text-[var(--n100-text-tertiary)] hover:text-[var(--n100-text-secondary)]",
              item.disabled && "cursor-not-allowed opacity-45",
            )}
            onClick={() => {
              if (!item.disabled) onChange?.(item.id);
            }}
          >
            {item.label}
            {item.badge ? (
              <span className="font-mono text-[0.55rem] uppercase tracking-[0.12em] text-[var(--n100-text-tertiary)]">
                {item.badge}
              </span>
            ) : null}
          </button>
        );
      })}
    </div>
  );
}

export function TabPanel({
  id,
  active,
  children,
  className,
}: {
  id: string;
  active: boolean;
  children: ReactNode;
  className?: string;
}) {
  if (!active) return null;
  return (
    <div role="tabpanel" id={`tabpanel-${id}`} aria-labelledby={`tab-${id}`} className={className}>
      {children}
    </div>
  );
}
