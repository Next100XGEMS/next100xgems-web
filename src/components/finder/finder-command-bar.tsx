"use client";

import { CommandSearch, FilterChip } from "@/components/product-experience";

import { FINDER_CHAINS, FINDER_COPY, FINDER_PRESETS } from "./finder-copy";

export function FinderCommandBar() {
  return (
    <div className="space-y-3 border-b border-[var(--n100-border-subtle)] bg-[var(--n100-canvas)] pb-3 pt-3">
      <div className="flex flex-col gap-3 lg:flex-row lg:items-start">
        <CommandSearch
          placeholder={FINDER_COPY.searchPlaceholder}
          helperText={FINDER_COPY.searchHelper}
          availabilityLabel="UNAVAILABLE"
          disabled
          readOnly
          aria-label="Search tokens"
        />
        <div className="flex shrink-0 flex-col gap-1.5 lg:max-w-xs">
          <p className="font-mono text-[0.5rem] font-semibold uppercase tracking-[0.14em] text-[var(--n100-text-tertiary)]">
            Saved views
          </p>
          <FilterChip disabled availabilityLabel="UNAVAILABLE">
            Default
          </FilterChip>
          <p className="text-[0.7rem] leading-5 text-[var(--n100-text-tertiary)]">
            {FINDER_COPY.savedViewsUnavailable}
          </p>
        </div>
      </div>

      <div className="flex gap-1.5 overflow-x-auto pb-0.5 [-ms-overflow-style:none] [scrollbar-width:none] [&::-webkit-scrollbar]:hidden">
        {FINDER_CHAINS.map((chain) => (
          <FilterChip key={chain.id} disabled availabilityLabel={chain.id === "all" ? "UNAVAILABLE" : undefined}>
            {chain.label}
          </FilterChip>
        ))}
      </div>

      <div className="flex flex-wrap items-center gap-1.5">
        <span className="mr-1 font-mono text-[0.5rem] font-semibold uppercase tracking-[0.14em] text-[var(--n100-text-tertiary)]">
          Presets
        </span>
        {FINDER_PRESETS.map((preset) => (
          <FilterChip key={preset.id} disabled availabilityLabel="UNAVAILABLE">
            {preset.label}
          </FilterChip>
        ))}
        <span className="w-full text-[0.7rem] leading-5 text-[var(--n100-text-tertiary)] sm:w-auto sm:ml-2">
          {FINDER_COPY.presetsUnavailable}
        </span>
      </div>
    </div>
  );
}
