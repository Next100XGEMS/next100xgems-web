import type { ComponentPropsWithoutRef, ReactNode } from "react";

type ClassValue = string | undefined | false;

function cx(...values: ClassValue[]) {
  return values.filter(Boolean).join(" ");
}

const statusStyles = {
  editorial: "border-[var(--n100-editorial)]/30 bg-[var(--n100-editorial)]/8 text-[var(--n100-editorial)]",
  sponsored: "border-[var(--n100-sponsored)]/45 bg-[var(--n100-sponsored)]/8 text-[var(--n100-sponsored)]",
  partner: "border-[var(--n100-partner)]/35 bg-[var(--n100-partner)]/8 text-[var(--n100-partner)]",
  advertisement:
    "border-[var(--n100-advertisement)]/40 bg-[var(--n100-advertisement)]/8 text-[var(--n100-advertisement)]",
  radar: "border-[var(--n100-radar)]/35 bg-[var(--n100-radar)]/8 text-[var(--n100-radar)]",
  "ai-assisted": "border-[var(--n100-ai-assisted)]/35 bg-[var(--n100-ai-assisted)]/8 text-[var(--n100-ai-assisted)]",
  "verified-data":
    "border-[var(--n100-verified-data)]/40 bg-[var(--n100-verified-data)]/8 text-[var(--n100-verified-data)]",
  "strong-signal":
    "border-[var(--n100-strong-signal)]/40 bg-[var(--n100-strong-signal)]/8 text-[var(--n100-strong-signal)]",
  "ai-inference": "border-[var(--n100-ai-inference)]/35 bg-[var(--n100-ai-inference)]/8 text-[var(--n100-ai-inference)]",
  unknown: "border-[var(--n100-unknown)]/30 bg-[var(--n100-unknown)]/8 text-[var(--n100-unknown)]",
  early: "border-[var(--n100-info)]/35 bg-[var(--n100-info)]/8 text-[var(--n100-info)]",
  trending: "border-[var(--n100-positive)]/35 bg-[var(--n100-positive)]/8 text-[var(--n100-positive)]",
  "high-risk": "border-[var(--n100-negative)]/35 bg-[var(--n100-negative)]/8 text-[var(--n100-negative)]",
} as const;

export type StatusKind = keyof typeof statusStyles;

const statusLabels: Record<StatusKind, string> = {
  editorial: "EDITORIAL",
  sponsored: "SPONSORED",
  partner: "PARTNER",
  advertisement: "ADVERTISEMENT",
  radar: "RADAR",
  "ai-assisted": "AI-ASSISTED",
  "verified-data": "VERIFIED DATA",
  "strong-signal": "STRONG SIGNAL",
  "ai-inference": "AI INFERENCE",
  unknown: "UNKNOWN",
  early: "EARLY",
  trending: "TRENDING",
  "high-risk": "HIGH RISK",
};

export function Container({
  className,
  size = "content",
  ...props
}: ComponentPropsWithoutRef<"div"> & { size?: "reading" | "content" | "wide" }) {
  const sizes = {
    reading: "max-w-[var(--n100-content-reading)]",
    content: "max-w-[var(--n100-content-max)]",
    wide: "max-w-[90rem]",
  } as const;

  return <div className={cx("mx-auto w-full px-[var(--n100-gutter)]", sizes[size], className)} {...props} />;
}

export function Section({
  className,
  density = "generous",
  ...props
}: ComponentPropsWithoutRef<"section"> & { density?: "compact" | "generous" }) {
  return (
    <section
      className={cx(
        density === "generous" ? "py-[var(--n100-section-gap)]" : "py-8",
        className,
      )}
      {...props}
    />
  );
}

export function Stack({
  className,
  gap = "md",
  ...props
}: ComponentPropsWithoutRef<"div"> & { gap?: "xs" | "sm" | "md" | "lg" }) {
  const gaps = { xs: "gap-1.5", sm: "gap-3", md: "gap-5", lg: "gap-8" } as const;
  return <div className={cx("flex flex-col", gaps[gap], className)} {...props} />;
}

export function Cluster({
  className,
  gap = "md",
  ...props
}: ComponentPropsWithoutRef<"div"> & { gap?: "xs" | "sm" | "md" | "lg" }) {
  const gaps = { xs: "gap-1.5", sm: "gap-2.5", md: "gap-4", lg: "gap-6" } as const;
  return <div className={cx("flex flex-wrap items-center", gaps[gap], className)} {...props} />;
}

export function InstrumentRule({ className }: { className?: string }) {
  return (
    <div aria-hidden="true" className={cx("flex items-center gap-1.5 text-[var(--n100-text-tertiary)]", className)}>
      <span className="h-px flex-1 bg-[var(--n100-border-strong)]/70" />
      <span className="h-1 w-px bg-[var(--n100-accent)]" />
      <span className="h-2 w-px bg-[var(--n100-border-strong)]" />
      <span className="h-1 w-px bg-[var(--n100-accent)]/70" />
      <span className="h-2 w-px bg-[var(--n100-border-strong)]" />
      <span className="h-px w-8 bg-[var(--n100-accent)]/70" />
    </div>
  );
}

type ButtonVariant = "primary" | "secondary" | "ghost" | "destructive";

export function Button({
  className,
  variant = "secondary",
  size = "md",
  loading = false,
  disabled,
  children,
  ...props
}: ComponentPropsWithoutRef<"button"> & {
  variant?: ButtonVariant;
  size?: "sm" | "md";
  loading?: boolean;
}) {
  const variants = {
    primary:
      "border-transparent bg-[var(--n100-accent)] text-[#11201a] hover:bg-[var(--n100-accent-strong)]",
    secondary:
      "border-[var(--n100-border-strong)] bg-[var(--n100-surface-secondary)] text-[var(--n100-text-primary)] hover:border-[var(--n100-accent)]/60 hover:bg-[var(--n100-surface-elevated)]",
    ghost:
      "border-transparent bg-transparent text-[var(--n100-text-secondary)] hover:bg-[var(--n100-surface-secondary)] hover:text-[var(--n100-text-primary)]",
    destructive:
      "border-[var(--n100-negative)]/50 bg-[var(--n100-negative)]/8 text-[var(--n100-negative)] hover:bg-[var(--n100-negative)]/15",
  } as const;
  const sizes = { sm: "min-h-8 px-3 text-xs", md: "min-h-10 px-4 text-sm" } as const;

  return (
    <button
      type="button"
      className={cx(
        "inline-flex items-center justify-center gap-2 rounded-[var(--n100-radius-control)] border font-medium tracking-[-0.01em] transition-colors disabled:cursor-not-allowed disabled:opacity-45",
        variants[variant],
        sizes[size],
        className,
      )}
      disabled={disabled || loading}
      aria-busy={loading || undefined}
      {...props}
    >
      {loading ? "Loading…" : children}
    </button>
  );
}

export function IconButton({
  label,
  className,
  ...props
}: ComponentPropsWithoutRef<"button"> & { label: string }) {
  return (
    <button
      type="button"
      aria-label={label}
      className={cx(
        "inline-flex size-9 items-center justify-center rounded-[var(--n100-radius-control)] border border-[var(--n100-border-subtle)] bg-transparent text-[var(--n100-text-secondary)] transition-colors hover:bg-[var(--n100-surface-secondary)] hover:text-[var(--n100-text-primary)]",
        className,
      )}
      {...props}
    />
  );
}

export function Panel({
  className,
  tone = "default",
  family = "neutral",
  padding = "md",
  ...props
}: ComponentPropsWithoutRef<"div"> & {
  tone?: "default" | "subtle" | "quiet";
  family?: "neutral" | "editorial" | "radar" | "commercial" | "admin";
  padding?: "sm" | "md" | "lg";
}) {
  const tones = {
    default: "border-[var(--n100-border-subtle)] bg-[var(--n100-surface-elevated)]",
    subtle: "border-[var(--n100-border-subtle)]/70 bg-[var(--n100-surface-secondary)]/65",
    quiet: "border-[var(--n100-border-subtle)]/60 bg-[var(--n100-surface-subtle)]",
  } as const;
  const families = {
    neutral: "",
    editorial: "bg-[var(--n100-surface-editorial)] border-[var(--n100-border-subtle)]",
    radar: "bg-[var(--n100-surface-radar)] border-[var(--n100-radar)]/30 border-t-2",
    commercial: "bg-[var(--n100-surface-commercial)] border-[var(--n100-sponsored)]/35 border-l-2",
    admin: "bg-[var(--n100-surface-admin)] border-[var(--n100-info)]/30 border-dashed",
  } as const;
  const paddings = { sm: "p-4", md: "p-5 sm:p-6", lg: "p-6 sm:p-8" } as const;

  return (
    <div
      className={cx(
        "rounded-[var(--n100-radius-panel)] border",
        family === "neutral" ? tones[tone] : undefined,
        families[family],
        paddings[padding],
        className,
      )}
      data-surface-family={family}
      {...props}
    />
  );
}

export function Divider({ className, ...props }: ComponentPropsWithoutRef<"hr">) {
  return <hr className={cx("border-0 border-t border-[var(--n100-border-subtle)]", className)} {...props} />;
}

export function StatusLabel({ kind, className }: { kind: StatusKind; className?: string }) {
  return (
    <span
      className={cx(
        "inline-flex min-h-6 items-center rounded-[var(--n100-radius-control)] border px-2 py-1 text-[0.625rem] font-semibold tracking-[0.13em]",
        statusStyles[kind],
        className,
      )}
    >
      {statusLabels[kind]}
    </span>
  );
}

export function DisclosureLabel({
  kind,
  className,
}: {
  kind: "editorial" | "sponsored" | "partner" | "advertisement" | "ai-assisted";
  className?: string;
}) {
  return <StatusLabel kind={kind} className={className} />;
}

export function DataValue({
  value,
  tone = "neutral",
  className,
}: {
  value: ReactNode;
  tone?: "neutral" | "positive" | "negative" | "warning";
  className?: string;
}) {
  const tones = {
    neutral: "text-[var(--n100-text-primary)]",
    positive: "text-[var(--n100-positive)]",
    negative: "text-[var(--n100-negative)]",
    warning: "text-[var(--n100-warning)]",
  } as const;
  return <span className={cx("font-mono text-sm tabular-nums", tones[tone], className)}>{value}</span>;
}

export function Metric({
  label,
  value,
  detail,
  tone = "neutral",
}: {
  label: string;
  value: ReactNode;
  detail?: ReactNode;
  tone?: "neutral" | "positive" | "negative" | "warning";
}) {
  return (
    <div className="min-w-0">
      <p className="text-[0.625rem] font-semibold uppercase tracking-[0.16em] text-[var(--n100-text-tertiary)]">{label}</p>
      <div className="mt-1.5 flex flex-wrap items-baseline gap-x-2 gap-y-1">
        <DataValue value={value} tone={tone} className="text-[1.05rem] tracking-[-0.02em]" />
        {detail ? <span className="text-xs text-[var(--n100-text-tertiary)]">{detail}</span> : null}
      </div>
    </div>
  );
}

export function SectionHeader({
  eyebrow,
  title,
  description,
  action,
}: {
  eyebrow?: string;
  title: string;
  description?: string;
  action?: ReactNode;
}) {
  return (
    <div className="flex flex-col gap-4 border-b border-[var(--n100-border-subtle)] pb-5 sm:flex-row sm:items-end sm:justify-between">
      <div className="max-w-2xl">
        {eyebrow ? <p className="mb-2 text-[0.625rem] font-semibold uppercase tracking-[0.18em] text-[var(--n100-accent)]">{eyebrow}</p> : null}
        <h2 className="text-xl font-semibold tracking-[-0.025em] text-[var(--n100-text-primary)] sm:text-2xl">{title}</h2>
        {description ? <p className="mt-2 text-sm leading-6 text-[var(--n100-text-secondary)]">{description}</p> : null}
      </div>
      {action ? <div className="shrink-0">{action}</div> : null}
    </div>
  );
}

export function PageHeader({ eyebrow, title, description }: { eyebrow?: string; title: string; description: string }) {
  return (
    <header className="max-w-3xl">
      {eyebrow ? <p className="mb-4 text-[0.625rem] font-semibold uppercase tracking-[0.2em] text-[var(--n100-accent)]">{eyebrow}</p> : null}
      <h1 className="text-4xl font-semibold tracking-[-0.045em] text-[var(--n100-text-primary)] sm:text-5xl">{title}</h1>
      <p className="mt-5 max-w-2xl text-base leading-7 text-[var(--n100-text-secondary)] sm:text-lg">{description}</p>
    </header>
  );
}

export function DataRow({
  label,
  value,
  detail,
  tone = "neutral",
}: {
  label: string;
  value: ReactNode;
  detail?: ReactNode;
  tone?: "neutral" | "positive" | "negative" | "warning";
}) {
  return (
    <div className="flex flex-col gap-1 border-b border-[var(--n100-border-subtle)]/75 py-3 last:border-b-0 sm:flex-row sm:items-baseline sm:justify-between sm:gap-6">
      <span className="text-sm text-[var(--n100-text-secondary)]">{label}</span>
      <span className="flex flex-wrap items-baseline gap-2 sm:justify-end">
        <DataValue value={value} tone={tone} />
        {detail ? <span className="text-xs text-[var(--n100-text-tertiary)]">{detail}</span> : null}
      </span>
    </div>
  );
}

export function KeyValueRow({ label, value, detail }: { label: string; value: ReactNode; detail?: ReactNode }) {
  return <DataRow label={label} value={value} detail={detail} />;
}

export function EmptyState({ title, description }: { title: string; description: string }) {
  return (
    <div className="border border-dashed border-[var(--n100-border-strong)]/70 bg-[var(--n100-surface-subtle)] px-5 py-8 text-center">
      <p className="text-sm font-medium text-[var(--n100-text-primary)]">{title}</p>
      <p className="mx-auto mt-2 max-w-md text-sm leading-6 text-[var(--n100-text-tertiary)]">{description}</p>
    </div>
  );
}

export function Skeleton({ className }: { className?: string }) {
  return <div aria-hidden="true" className={cx("animate-pulse rounded-[var(--n100-radius-control)] bg-[var(--n100-surface-secondary)]", className)} />;
}

export function VisuallyHidden({ children }: { children: ReactNode }) {
  return <span className="absolute size-px overflow-hidden whitespace-nowrap border-0 p-0 [clip:rect(0,0,0,0)]">{children}</span>;
}
