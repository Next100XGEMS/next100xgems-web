import { DataValue } from "@/components/ui";

export default function SystemStatusRow({ label, value, detail, tone = "neutral" }: { label: string; value: string; detail: string; tone?: "neutral" | "positive" | "warning" }) {
  const dot = tone === "positive" ? "bg-[var(--n100-positive)]" : tone === "warning" ? "bg-[var(--n100-warning)]" : "bg-[var(--n100-text-tertiary)]";
  const text = tone === "positive" ? "text-[var(--n100-positive)]" : tone === "warning" ? "text-[var(--n100-warning)]" : "text-[var(--n100-text-secondary)]";

  return (
    <div className="flex flex-col gap-2 border-b border-[var(--n100-border-subtle)]/80 py-3 last:border-b-0 sm:flex-row sm:items-center sm:justify-between sm:gap-6">
      <div className="flex min-w-0 items-center gap-3">
        <span aria-hidden="true" className={`size-1.5 shrink-0 rounded-full ${dot}`} />
        <span className="text-sm text-[var(--n100-text-secondary)]">{label}</span>
      </div>
      <div className="flex items-baseline gap-3 sm:justify-end">
        <DataValue value={value} tone={tone === "positive" ? "positive" : tone === "warning" ? "warning" : "neutral"} className={`text-xs ${text}`} />
        <span className="text-xs text-[var(--n100-text-tertiary)]">{detail}</span>
      </div>
    </div>
  );
}
