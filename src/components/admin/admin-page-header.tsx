import { InstrumentRule, PageHeader } from "@/components/ui";

export default function AdminPageHeader({ eyebrow, title, description, status = "READ ONLY" }: { eyebrow: string; title: string; description: string; status?: string }) {
  return (
    <header>
      <div className="flex flex-wrap items-start justify-between gap-4">
        <PageHeader eyebrow={eyebrow} title={title} description={description} />
        <span className="border border-[var(--n100-border-strong)] px-2 py-1 font-mono text-[0.625rem] font-semibold tracking-[0.14em] text-[var(--n100-text-tertiary)]">{status}</span>
      </div>
      <InstrumentRule className="mt-6 max-w-xl" />
    </header>
  );
}
