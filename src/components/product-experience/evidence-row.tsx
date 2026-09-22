import type { ReactNode } from "react";

import { StatusLabel, type StatusKind } from "@/components/ui";

import { cx } from "./cx";

export type EvidenceChipItem = {
  id: string;
  label: string;
  kind?: StatusKind;
  tone?: "neutral" | "warning" | "muted";
};

export function EvidenceChip({
  label,
  kind,
  tone = "neutral",
}: {
  label: string;
  kind?: StatusKind;
  tone?: "neutral" | "warning" | "muted";
}) {
  if (kind) return <StatusLabel kind={kind} />;

  const tones = {
    neutral: "border-[var(--n100-border-strong)] text-[var(--n100-text-secondary)]",
    warning: "border-[var(--n100-warning)]/45 text-[var(--n100-warning)]",
    muted: "border-[var(--n100-border-subtle)] text-[var(--n100-text-tertiary)]",
  } as const;

  return (
    <span
      className={cx(
        "inline-flex min-h-6 items-center rounded-[var(--n100-radius-control)] border px-2 py-0.5 font-mono text-[0.55rem] font-semibold uppercase tracking-[0.12em]",
        tones[tone],
      )}
    >
      {label}
    </span>
  );
}

export function EvidenceRow({
  items,
  label = "Evidence",
  emptyLabel = "NO_DATA",
  className,
  trailing,
}: {
  items: readonly EvidenceChipItem[];
  label?: string;
  emptyLabel?: string;
  className?: string;
  trailing?: ReactNode;
}) {
  return (
    <div className={cx("flex flex-wrap items-center gap-2", className)}>
      <span className="font-mono text-[0.55rem] font-semibold uppercase tracking-[0.14em] text-[var(--n100-text-tertiary)]">
        {label}
      </span>
      {items.length === 0 ? (
        <EvidenceChip label={emptyLabel} tone="muted" />
      ) : (
        items.map((item) => (
          <EvidenceChip key={item.id} label={item.label} kind={item.kind} tone={item.tone} />
        ))
      )}
      {trailing}
    </div>
  );
}
