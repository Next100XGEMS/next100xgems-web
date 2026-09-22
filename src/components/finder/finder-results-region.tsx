"use client";

import { DataTable, EvidenceRow } from "@/components/product-experience";
import { EmptyState, Panel } from "@/components/ui";

import type { FinderResultsState } from "./finder-contracts";
import { FINDER_COPY } from "./finder-copy";
import { FinderRowActions } from "./finder-row-actions";

export type FinderResultsRegionProps = {
  state?: FinderResultsState;
  className?: string;
};

function ResultsEmpty({ state }: { state: FinderResultsState }) {
  const title = state === "UNAVAILABLE" ? FINDER_COPY.resultsUnavailableTitle : FINDER_COPY.resultsEmptyTitle;
  const description =
    state === "UNAVAILABLE" ? FINDER_COPY.resultsUnavailableDescription : FINDER_COPY.resultsEmptyDescription;
  const code = state === "UNAVAILABLE" ? "UNAVAILABLE" : "EMPTY";

  return (
    <Panel tone="quiet" padding="md" className="border-dashed">
      <p className="mb-3 font-mono text-[0.55rem] font-semibold uppercase tracking-[0.16em] text-[var(--n100-warning)]">
        {code}
      </p>
      <EmptyState title={title} description={description} />
      <div className="mt-4 border-t border-[var(--n100-border-subtle)] pt-4">
        <EvidenceRow items={[]} emptyLabel="NO_DATA" label="Evidence slot" />
        <div className="mt-4">
          <FinderRowActions />
        </div>
      </div>
    </Panel>
  );
}

/**
 * Dense results region. Never binds PublicRadarFeed. Never fabricates rows.
 * Desktop: DataTable chrome with empty/unavailable EmptyState.
 * Mobile: compact card EmptyState (same honesty).
 */
export function FinderResultsRegion({ state = "EMPTY", className }: FinderResultsRegionProps) {
  return (
    <section className={className} aria-label="Finder results" data-finder-results-state={state}>
      {/* Desktop dense table shell */}
      <div className="hidden lg:block">
        <DataTable
          caption="Finder discovery results"
          columns={[
            {
              id: "identity",
              header: "Token",
              render: () => null,
            },
            {
              id: "metric",
              header: "Primary",
              align: "right" as const,
              render: () => null,
            },
            {
              id: "risk",
              header: "Risk",
              render: () => null,
            },
            {
              id: "evidence",
              header: "Evidence",
              align: "right" as const,
              render: () => null,
            },
            {
              id: "actions",
              header: "Actions",
              render: () => null,
            },
          ]}
          rows={[]}
          getRowId={() => "none"}
          empty={<ResultsEmpty state={state} />}
        />
      </div>

      {/* Mobile compact cards region */}
      <div className="lg:hidden">
        <ResultsEmpty state={state} />
        <p className="mt-3 text-[0.7rem] leading-5 text-[var(--n100-text-tertiary)]">
          Mobile cards show identity, primary metric, risk chip, and evidence count when a live Finder feed exists.
          Row actions remain Watch / Analyze.
        </p>
      </div>
    </section>
  );
}
