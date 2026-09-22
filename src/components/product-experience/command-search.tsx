"use client";

import { useEffect, useId, useRef, type ComponentPropsWithoutRef } from "react";

import { cx } from "./cx";

export type CommandSearchProps = Omit<ComponentPropsWithoutRef<"input">, "type"> & {
  helperText?: string;
  availabilityLabel?: string;
};

/**
 * Always-visible compact search field with optional `/` focus affordance.
 * Does not invent results — callers own availability/disabled state.
 */
export function CommandSearch({
  className,
  helperText,
  availabilityLabel,
  disabled,
  id,
  onKeyDown,
  ...props
}: CommandSearchProps) {
  const generatedId = useId();
  const inputId = id ?? generatedId;
  const helperId = helperText ? `${inputId}-helper` : undefined;
  const inputRef = useRef<HTMLInputElement>(null);

  useEffect(() => {
    if (disabled) return;

    function onGlobalKeyDown(event: KeyboardEvent) {
      if (event.key !== "/" || event.metaKey || event.ctrlKey || event.altKey) return;
      const target = event.target as HTMLElement | null;
      if (target && (target.tagName === "INPUT" || target.tagName === "TEXTAREA" || target.isContentEditable)) {
        return;
      }
      event.preventDefault();
      inputRef.current?.focus();
    }

    window.addEventListener("keydown", onGlobalKeyDown);
    return () => window.removeEventListener("keydown", onGlobalKeyDown);
  }, [disabled]);

  return (
    <div className={cx("min-w-0 flex-1", className)}>
      <label htmlFor={inputId} className="sr-only">
        {props["aria-label"] ?? "Search"}
      </label>
      <div
        className={cx(
          "flex min-h-11 items-center gap-2 rounded-[var(--n100-radius-control)] border border-[var(--n100-border-strong)] bg-[var(--n100-surface-elevated)] px-3",
          disabled && "opacity-55",
        )}
      >
        <span aria-hidden="true" className="font-mono text-[0.65rem] text-[var(--n100-text-tertiary)]">
          /
        </span>
        <input
          ref={inputRef}
          id={inputId}
          type="search"
          disabled={disabled}
          aria-disabled={disabled || undefined}
          aria-describedby={helperId}
          className="min-w-0 flex-1 bg-transparent text-sm text-[var(--n100-text-primary)] outline-none placeholder:text-[var(--n100-text-tertiary)] disabled:cursor-not-allowed"
          onKeyDown={onKeyDown}
          {...props}
        />
        {availabilityLabel ? (
          <span className="shrink-0 font-mono text-[0.55rem] font-semibold uppercase tracking-[0.14em] text-[var(--n100-warning)]">
            {availabilityLabel}
          </span>
        ) : null}
      </div>
      {helperText ? (
        <p id={helperId} className="mt-1.5 text-xs leading-5 text-[var(--n100-text-tertiary)]">
          {helperText}
        </p>
      ) : null}
    </div>
  );
}
