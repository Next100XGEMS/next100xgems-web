export const HISTORICAL_OUTCOME_LABELS = [
  "SURVIVED_24H", "SURVIVED_7D", "LIQUIDITY_COLLAPSE", "CREATOR_EXIT_EVENT",
  "HIGH_CONCENTRATION", "GRADUATED", "FAILED_TO_GRADUATE", "SUSTAINED_ACTIVITY",
  "ACTIVITY_COLLAPSE", "STRONG_ACTIVITY_WEAK_LIQUIDITY", "PROVIDER_DISAGREEMENT",
] as const;
export type HistoricalOutcomeLabel = (typeof HISTORICAL_OUTCOME_LABELS)[number];

export type HistoricalDatasetSplit = "TRAIN" | "VALIDATION" | "HOLDOUT";
export type HistoricalOutcomeSample = { sampleId: string; chain: string; tokenAddress: string; launchObservedAt: string; cutoffAt: string; split: HistoricalDatasetSplit; categories: readonly string[]; labels: readonly HistoricalOutcomeLabel[]; evidenceReferences: readonly string[]; labelVersion: string };

/** Labels structural observations, never investment outcomes or intent. */
export function assertSafeHistoricalLabels(labels: readonly string[]): labels is readonly HistoricalOutcomeLabel[] {
  return labels.every((label) => (HISTORICAL_OUTCOME_LABELS as readonly string[]).includes(label));
}

export function chronologicalSplit(launchObservedAt: string, cutoffs: { validationAfter: string; holdoutAfter: string }): HistoricalDatasetSplit {
  const launch = Date.parse(launchObservedAt); const validation = Date.parse(cutoffs.validationAfter); const holdout = Date.parse(cutoffs.holdoutAfter);
  if (!Number.isFinite(launch) || !Number.isFinite(validation) || !Number.isFinite(holdout) || validation >= holdout) throw new Error("Historical split boundaries must be valid and chronological.");
  return launch >= holdout ? "HOLDOUT" : launch >= validation ? "VALIDATION" : "TRAIN";
}
