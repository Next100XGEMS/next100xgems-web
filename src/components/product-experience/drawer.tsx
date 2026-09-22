"use client";

import { useEffect, type ReactNode } from "react";

import { IconButton } from "@/components/ui";

import { cx } from "./cx";

export type DrawerProps = {
  open: boolean;
  title: string;
  onClose?: () => void;
  children: ReactNode;
  className?: string;
  emptyMessage?: string;
  availabilityLabel?: string;
};

export function Drawer({
  open,
  title,
  onClose,
  children,
  className,
  emptyMessage,
  availabilityLabel,
}: DrawerProps) {
  useEffect(() => {
    if (!open) return;
    function onKeyDown(event: KeyboardEvent) {
      if (event.key === "Escape") onClose?.();
    }
    window.addEventListener("keydown", onKeyDown);
    return () => window.removeEventListener("keydown", onKeyDown);
  }, [open, onClose]);

  if (!open) return null;

  return (
    <aside
      className={cx(
        "flex w-full flex-col border border-[var(--n100-border-subtle)] bg-[var(--n100-surface-elevated)] lg:w-80 lg:shrink-0",
        className,
      )}
      aria-label={title}
    >
      <div className="flex items-center justify-between gap-2 border-b border-[var(--n100-border-subtle)] px-4 py-3">
        <div className="min-w-0">
          <p className="truncate text-sm font-semibold tracking-[-0.02em] text-[var(--n100-text-primary)]">{title}</p>
          {availabilityLabel ? (
            <p className="mt-0.5 font-mono text-[0.5rem] uppercase tracking-[0.12em] text-[var(--n100-warning)]">
              {availabilityLabel}
            </p>
          ) : null}
        </div>
        {onClose ? (
          <IconButton label="Close inspector" onClick={onClose} className="size-9 shrink-0">
            <span aria-hidden="true">×</span>
          </IconButton>
        ) : null}
      </div>
      <div className="flex-1 overflow-y-auto p-4">
        {emptyMessage ? (
          <p className="text-sm leading-6 text-[var(--n100-text-tertiary)]">{emptyMessage}</p>
        ) : (
          children
        )}
      </div>
    </aside>
  );
}
