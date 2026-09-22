"use client";

import { Button } from "@/components/ui";

import { FINDER_COPY } from "./finder-copy";

export type FinderRowActionsProps = {
  compact?: boolean;
  className?: string;
};

/**
 * Row actions for Finder. Watch + Analyze stay visible but disabled with honest labels.
 * Never calls private Analyzer APIs. Never mutates a watchlist.
 */
export function FinderRowActions({ compact = false, className }: FinderRowActionsProps) {
  return (
    <div className={className}>
      <div className={`flex ${compact ? "flex-col gap-1.5" : "flex-wrap items-center gap-2"}`}>
        <Button
          type="button"
          size="sm"
          variant="secondary"
          disabled
          aria-disabled="true"
          title={FINDER_COPY.watchHelper}
          className="min-h-9"
        >
          Watch
          <span className="font-mono text-[0.5rem] uppercase tracking-[0.1em] text-[var(--n100-warning)]">
            COMING_SOON
          </span>
        </Button>
        <Button
          type="button"
          size="sm"
          variant="ghost"
          disabled
          aria-disabled="true"
          title={FINDER_COPY.analyzeHelper}
          className="min-h-9"
        >
          Analyze
          <span className="font-mono text-[0.5rem] uppercase tracking-[0.1em] text-[var(--n100-warning)]">
            FEATURE_DISABLED
          </span>
        </Button>
      </div>
      {!compact ? (
        <div className="mt-2 space-y-1 text-[0.7rem] leading-5 text-[var(--n100-text-tertiary)]">
          <p>{FINDER_COPY.watchHelper}</p>
          <p>{FINDER_COPY.analyzeHelper}</p>
        </div>
      ) : null}
    </div>
  );
}
