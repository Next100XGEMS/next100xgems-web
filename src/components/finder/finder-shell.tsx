"use client";

import { useState } from "react";

import { Drawer } from "@/components/product-experience";
import { Button, Container } from "@/components/ui";

import type { FinderCapabilities } from "./finder-contracts";
import { FINDER_BATCH1_CAPABILITIES } from "./finder-contracts";
import { FINDER_COPY } from "./finder-copy";
import { FinderCommandBar } from "./finder-command-bar";
import { FinderFilterDrawer, FinderFilterRail } from "./finder-filter-rail";
import { FinderResultsRegion } from "./finder-results-region";

export type FinderShellProps = {
  capabilities?: FinderCapabilities;
};

/**
 * Evidence-first discovery desk shell.
 * First paint = search + filters + results region. Zero editorial prose above the fold.
 * Sponsored strip stays hidden until a real sponsored contract exists.
 */
export default function FinderShell({ capabilities = FINDER_BATCH1_CAPABILITIES }: FinderShellProps) {
  const [filtersOpen, setFiltersOpen] = useState(false);
  // Lead Integration cert: sponsored rail separate; show only with a real sponsored contract.
  // Batch-1 capability is NOT_CONFIGURED → never render commercial strip.
  const showSponsored = false;

  return (
    <div className="min-h-[70vh] bg-[var(--n100-canvas)]" data-finder-shell="v2-batch1">
      <Container size="wide" className="pb-10">
        <FinderCommandBar />

        <div className="mt-3 flex items-center justify-between gap-3 lg:hidden">
          <Button
            type="button"
            size="sm"
            variant="secondary"
            className="min-h-11"
            onClick={() => setFiltersOpen(true)}
          >
            Filters
            <span className="font-mono text-[0.5rem] uppercase tracking-[0.1em] text-[var(--n100-warning)]">
              UNAVAILABLE
            </span>
          </Button>
          <span className="font-mono text-[0.55rem] uppercase tracking-[0.12em] text-[var(--n100-text-tertiary)]">
            RESULTS · {capabilities.results}
          </span>
        </div>

        {showSponsored ? (
          <div className="mt-3 border border-[var(--n100-sponsored)]/35 bg-[var(--n100-surface-commercial)] px-3 py-2">
            <p className="font-mono text-[0.55rem] uppercase tracking-[0.14em] text-[var(--n100-sponsored)]">
              Sponsored
            </p>
          </div>
        ) : (
          <p className="sr-only">{FINDER_COPY.sponsoredHidden}</p>
        )}

        <div className="mt-4 grid gap-4 lg:grid-cols-[14rem_minmax(0,1fr)_20rem] lg:items-start">
          <div className="hidden lg:block">
            <FinderFilterRail />
          </div>

          <FinderResultsRegion state={capabilities.results} />

          <div className="hidden lg:block">
            <Drawer
              open
              title="Inspector"
              availabilityLabel="EMPTY"
              emptyMessage={FINDER_COPY.inspectorEmpty}
            >
              {null}
            </Drawer>
          </div>
        </div>
      </Container>

      <FinderFilterDrawer open={filtersOpen} onClose={() => setFiltersOpen(false)} />
    </div>
  );
}
