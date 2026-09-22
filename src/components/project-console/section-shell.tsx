import type { ReactNode } from "react";

import { EmptyState, InstrumentRule, PageHeader, Panel } from "@/components/ui";

export default function ProjectSectionShell({
  eyebrow,
  title,
  description,
  emptyTitle,
  emptyDescription,
  children,
}: {
  eyebrow: string;
  title: string;
  description: string;
  emptyTitle?: string;
  emptyDescription?: string;
  children?: ReactNode;
}) {
  return (
    <div className="space-y-8">
      <header>
        <PageHeader eyebrow={eyebrow} title={title} description={description} />
        <InstrumentRule className="mt-6 max-w-xl" />
      </header>
      {children}
      {emptyTitle && emptyDescription ? (
        <Panel tone="quiet">
          <EmptyState title={emptyTitle} description={emptyDescription} />
        </Panel>
      ) : null}
    </div>
  );
}
