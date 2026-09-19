import { sha256 } from "@/lib/radar/hash";
import { assertSafeHistoricalLabels, HISTORICAL_OUTCOME_LABELS, type HistoricalDatasetSplit, type HistoricalOutcomeLabel } from "@/lib/radar/acceptance/historical";

export const HISTORICAL_CUTOFFS = ["T+5M", "T+15M", "T+30M", "T+1H", "T+6H", "T+24H"] as const;
export type HistoricalCutoff = (typeof HISTORICAL_CUTOFFS)[number];
export type SolanaCorpusCategory = "VERY_NEW" | "ACTIVE_CURVE" | "NEAR_GRADUATION" | "GRADUATED" | "FAILED_TO_GRADUATE" | "DEAD" | "HIGH_VOLUME_FAILURE" | "LIQUIDITY_COLLAPSE" | "CONCENTRATED" | "BROAD_DISTRIBUTION" | "CREATOR_EXIT" | "CREATOR_RETAINED" | "SUSTAINED_ACTIVITY" | "ACTIVITY_COLLAPSE" | "PROVIDER_DISAGREEMENT" | "INCOMPLETE_DATA";
export type HistoricalCorpusEntry = { sampleId: string; chain: "solana"; mint: string; category: SolanaCorpusCategory; launchObservedAt: string; cutoffs: readonly { name: HistoricalCutoff; cutoffAt: string; inputManifestHash: string; }[]; labels: readonly HistoricalOutcomeLabel[]; labelEvidence: readonly string[]; split: HistoricalDatasetSplit; selectionReason: string };
export type HistoricalCorpusManifest = { schemaVersion: "radar-solana-historical-corpus-v1"; frozenAt: string; targetSize: 300 | 500; labelVersion: string; selectionRules: readonly string[]; samples: readonly HistoricalCorpusEntry[]; corpusHash: string; readyForMethodology: boolean };

export function buildHistoricalCorpus(input: { samples: readonly HistoricalCorpusEntry[]; frozenAt: string; targetSize?: 300 | 500; labelVersion: string; selectionRules: readonly string[] }): HistoricalCorpusManifest {
  const ids = new Set<string>();
  for (const sample of input.samples) {
    if (ids.has(sample.sampleId)) throw new Error("Historical corpus sample IDs must be unique.");
    ids.add(sample.sampleId);
    if (!sample.mint || !sample.selectionReason || sample.cutoffs.length === 0) throw new Error("Historical corpus samples require identity, selection reason and point-in-time cutoffs.");
    if (!assertSafeHistoricalLabels(sample.labels)) throw new Error("Historical corpus contains an unsafe outcome label.");
    for (const cutoff of sample.cutoffs) if (!(HISTORICAL_CUTOFFS as readonly string[]).includes(cutoff.name) || !Number.isFinite(Date.parse(cutoff.cutoffAt)) || !cutoff.inputManifestHash) throw new Error("Historical corpus cutoff is incomplete or invalid.");
  }
  const targetSize = input.targetSize ?? 300;
  const frozen = { schemaVersion: "radar-solana-historical-corpus-v1" as const, frozenAt: input.frozenAt, targetSize, labelVersion: input.labelVersion, selectionRules: input.selectionRules, samples: input.samples };
  return { ...frozen, corpusHash: sha256(frozen), readyForMethodology: input.samples.length >= targetSize && input.samples.every((sample) => sample.cutoffs.length >= 4 && sample.labels.length > 0) };
}

export function corpusCategoryCounts(samples: readonly HistoricalCorpusEntry[]): Record<SolanaCorpusCategory, number> {
  const counts = {} as Record<SolanaCorpusCategory, number>;
  for (const sample of samples) counts[sample.category] = (counts[sample.category] ?? 0) + 1;
  return counts;
}

export function requiredHistoricalLabelVocabulary(): readonly HistoricalOutcomeLabel[] { return HISTORICAL_OUTCOME_LABELS; }
