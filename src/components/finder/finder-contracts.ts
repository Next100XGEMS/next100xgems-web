/**
 * Honest Finder surface contracts for Platform Experience V2 batch 1.
 * No Finder API. No fabricated token rows. PublicRadarFeed is not a Finder source.
 */
export type FinderCapabilityState =
  | "NO_DATA"
  | "UNKNOWN"
  | "DISABLED"
  | "NOT_CONFIGURED"
  | "COMING_SOON"
  | "UNAVAILABLE"
  | "FEATURE_DISABLED"
  | "EMPTY";

export type FinderResultsState = "EMPTY" | "UNAVAILABLE";

export type FinderCapabilities = {
  search: FinderCapabilityState;
  filters: FinderCapabilityState;
  sort: FinderCapabilityState;
  savedViews: FinderCapabilityState;
  watchlist: FinderCapabilityState;
  publicAnalyzer: FinderCapabilityState;
  sponsored: FinderCapabilityState;
  results: FinderResultsState;
};

/** Batch-1 defaults: chrome only; every capability is honestly unavailable. */
export const FINDER_BATCH1_CAPABILITIES: FinderCapabilities = {
  search: "UNAVAILABLE",
  filters: "UNAVAILABLE",
  sort: "UNAVAILABLE",
  savedViews: "UNAVAILABLE",
  watchlist: "COMING_SOON",
  publicAnalyzer: "FEATURE_DISABLED",
  sponsored: "NOT_CONFIGURED",
  results: "EMPTY",
};
