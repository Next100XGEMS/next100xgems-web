import type { ReactNode } from "react";

import { EmptyState, InstrumentRule, PageHeader, Panel } from "@/components/ui";

export default function ProjectSectionShell({
  eyebrow,
  title,
  description,
  emptyTitle,
  emptyDescription,
  emptyCode,
  children,
}: {
  eyebrow: string;
  title: string;
  description: string;
  emptyTitle?: string;
  emptyDescription?: string;
  emptyCode?: "NO_DATA" | "COMING_SOON" | "DISABLED";
  children?: ReactNode;
}) {
  return (
    <div className="space-y-7">
      <header>
        <PageHeader eyebrow={eyebrow} title={title} description={description} />
        <InstrumentRule className="mt-5 max-w-xl" />
      </header>
      {children}
      {emptyTitle && emptyDescription ? (
        <Panel family="admin" padding="md">
          {emptyCode ? (
            <p className="mb-3 font-mono text-[0.625rem] font-semibold uppercase tracking-[0.16em] text-[var(--n100-info)]">
              {emptyCode}
            </p>
          ) : null}
          <EmptyState title={emptyTitle} description={emptyDescription} />
        </Panel>
      ) : null}
    </div>
  );
}
