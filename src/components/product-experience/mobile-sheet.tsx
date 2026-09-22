"use client";

import { useEffect, type ReactNode } from "react";

import { Button } from "@/components/ui";

import { cx } from "./cx";

export type MobileSheetProps = {
  open: boolean;
  title: string;
  onClose: () => void;
  children: ReactNode;
  className?: string;
  footer?: ReactNode;
};

export function MobileSheet({ open, title, onClose, children, className, footer }: MobileSheetProps) {
  useEffect(() => {
    if (!open) return;
    const previous = document.body.style.overflow;
    document.body.style.overflow = "hidden";
    function onKeyDown(event: KeyboardEvent) {
      if (event.key === "Escape") onClose();
    }
    window.addEventListener("keydown", onKeyDown);
    return () => {
      document.body.style.overflow = previous;
      window.removeEventListener("keydown", onKeyDown);
    };
  }, [open, onClose]);

  if (!open) return null;

  return (
    <div className="fixed inset-0 z-50 lg:hidden" role="presentation">
      <button
        type="button"
        className="absolute inset-0 bg-black/55"
        aria-label="Dismiss sheet"
        onClick={onClose}
      />
      <div
        role="dialog"
        aria-modal="true"
        aria-label={title}
        className={cx(
          "absolute inset-x-0 bottom-0 max-h-[85vh] overflow-y-auto rounded-t-[var(--n100-radius-panel)] border border-[var(--n100-border-subtle)] bg-[var(--n100-surface-elevated)] shadow-2xl",
          className,
        )}
      >
        <div className="sticky top-0 z-10 flex items-center justify-between gap-3 border-b border-[var(--n100-border-subtle)] bg-[var(--n100-surface-elevated)] px-4 py-3">
          <div className="mx-auto absolute left-1/2 top-2 h-1 w-10 -translate-x-1/2 rounded-full bg-[var(--n100-border-strong)]" aria-hidden="true" />
          <p className="pt-2 text-sm font-semibold text-[var(--n100-text-primary)]">{title}</p>
          <Button variant="ghost" size="sm" onClick={onClose} aria-label="Close sheet">
            Close
          </Button>
        </div>
        <div className="px-4 py-4">{children}</div>
        {footer ? <div className="border-t border-[var(--n100-border-subtle)] px-4 py-3">{footer}</div> : null}
      </div>
    </div>
  );
}
