"use client";

import { FilterChip, FilterGroup, FilterRail, MobileSheet } from "@/components/product-experience";
import { Button } from "@/components/ui";

import { FINDER_COPY } from "./finder-copy";

const FILTER_GROUPS = [
  {
    id: "liquidity",
    label: "Liquidity",
    options: ["Any", ">$50k", ">$250k"],
  },
  {
    id: "age",
    label: "Age",
    options: ["Any", "<24h", "<7d"],
  },
  {
    id: "evidence",
    label: "Evidence",
    options: ["Any", "Verified", "High count"],
  },
  {
    id: "risk",
    label: "Risk",
    options: ["Any", "Exclude high", "Unknown only"],
  },
] as const;

function FilterBody() {
  return (
    <div className="space-y-5">
      {FILTER_GROUPS.map((group) => (
        <FilterGroup key={group.id} label={group.label}>
          {group.options.map((option) => (
            <FilterChip key={option} disabled availabilityLabel="UNAVAILABLE">
              {option}
            </FilterChip>
          ))}
        </FilterGroup>
      ))}
      <FilterGroup label="Sort">
        <FilterChip disabled availabilityLabel="UNAVAILABLE">
          Relevance
        </FilterChip>
        <FilterChip disabled availabilityLabel="UNAVAILABLE">
          Freshness
        </FilterChip>
        <FilterChip disabled availabilityLabel="UNAVAILABLE">
          Liquidity
        </FilterChip>
      </FilterGroup>
    </div>
  );
}

/** Desktop filter rail — controls present but disabled; no Finder query contract. */
export function FinderFilterRail({ className }: { className?: string }) {
  return (
    <FilterRail
      className={className}
      title="Filters"
      availabilityLabel="UNAVAILABLE"
      helperText={FINDER_COPY.filtersHelper}
    >
      <FilterBody />
    </FilterRail>
  );
}

/** Mobile filters via bottom sheet — same unavailable semantics. */
export function FinderFilterDrawer({
  open,
  onClose,
}: {
  open: boolean;
  onClose: () => void;
}) {
  return (
    <MobileSheet
      open={open}
      onClose={onClose}
      title="Filters"
      footer={
        <Button type="button" variant="secondary" className="w-full" disabled>
          Apply filters · UNAVAILABLE
        </Button>
      }
    >
      <p className="mb-4 text-xs leading-5 text-[var(--n100-text-tertiary)]">{FINDER_COPY.filtersHelper}</p>
      <p className="mb-4 font-mono text-[0.55rem] font-semibold uppercase tracking-[0.14em] text-[var(--n100-warning)]">
        UNAVAILABLE
      </p>
      <FilterBody />
    </MobileSheet>
  );
}
