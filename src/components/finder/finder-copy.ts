/** Locked Product Experience V2 batch-1 copy. Do not invent alternatives. */
export const FINDER_COPY = {
  searchPlaceholder: "Search tokens (unavailable)",
  searchHelper: "Search is not connected in this release.",
  filtersHelper: "Filters unavailable — no Finder query contract yet.",
  watchHelper: "Watchlist unavailable — coming soon.",
  analyzeHelper: "Public Analyzer is not enabled.",
  resultsEmptyTitle: "No Finder results yet",
  resultsEmptyDescription:
    "This workspace is shell-ready. Live discovery data is not connected in this batch.",
  resultsUnavailableTitle: "Finder data unavailable",
  resultsUnavailableDescription:
    "Token discovery is not available right now. Nothing here is fabricated.",
  inspectorEmpty: "Select a result to inspect evidence. No row selected.",
  presetsUnavailable: "Presets require a Finder query contract.",
  savedViewsUnavailable: "Saved views unavailable.",
  sponsoredHidden: "Sponsored placements appear only with a real sponsored contract.",
} as const;

export const FINDER_CHAINS = [
  { id: "all", label: "All chains" },
  { id: "solana", label: "Solana" },
  { id: "base", label: "Base" },
  { id: "ethereum", label: "Ethereum" },
  { id: "bnb", label: "BNB" },
] as const;

export const FINDER_PRESETS = [
  { id: "fresh", label: "Fresh" },
  { id: "liquid", label: "Liquid" },
  { id: "high-evidence", label: "High-evidence" },
] as const;
