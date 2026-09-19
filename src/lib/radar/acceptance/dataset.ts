import type { AcceptanceChain, AcceptanceDataset, AcceptanceSample, AcceptanceSampleCategory, AcceptanceTier } from "@/lib/radar/acceptance/contracts";

const ID = /^[a-z0-9][a-z0-9_-]{1,63}$/;
const CATEGORIES: readonly AcceptanceSampleCategory[] = ["NEW_LAUNCH", "ACTIVE_LAUNCH", "NEAR_MIGRATION", "RECENTLY_MIGRATED", "ESTABLISHED", "DEAD_FAILED", "CONCENTRATED", "HIGH_VOLUME", "SUSPICIOUS_RISKY"];

export function createAcceptanceSample(input: { sampleId: string; chain: AcceptanceChain; tier: AcceptanceTier; category: AcceptanceSampleCategory; tokenAddress?: string | null; label?: string | null; notes?: string | null; approvedForLiveProbe?: boolean }): AcceptanceSample {
  if (!ID.test(input.sampleId)) throw new Error("Acceptance sample IDs must be bounded identifiers.");
  if (!CATEGORIES.includes(input.category)) throw new Error("Acceptance sample category is unsupported.");
  return { sampleId: input.sampleId, chain: input.chain, tier: input.tier, category: input.category, tokenAddress: input.tokenAddress ?? null, label: input.label ?? null, notes: input.notes ?? null, approvedForLiveProbe: input.approvedForLiveProbe ?? false };
}

export function createAcceptanceDataset(samples: readonly AcceptanceSample[], createdAt = new Date().toISOString()): AcceptanceDataset {
  const ids = new Set<string>();
  for (const sample of samples) {
    if (ids.has(sample.sampleId)) throw new Error("Acceptance dataset sample IDs must be unique.");
    ids.add(sample.sampleId);
  }
  return { schemaVersion: "radar-acceptance-dataset-v1", createdAt, samples: [...samples] };
}

export const acceptanceDatasetTemplate = createAcceptanceDataset([
  createAcceptanceSample({ sampleId: "solana-001", chain: "solana", tier: "A_DEEP", category: "NEW_LAUNCH" }),
  createAcceptanceSample({ sampleId: "bnb-001", chain: "bnb", tier: "A_DEEP", category: "NEW_LAUNCH" }),
  createAcceptanceSample({ sampleId: "base-001", chain: "base", tier: "A_DEEP", category: "ACTIVE_LAUNCH" }),
  createAcceptanceSample({ sampleId: "ethereum-001", chain: "ethereum", tier: "A_DEEP", category: "ESTABLISHED" }),
  createAcceptanceSample({ sampleId: "monad-001", chain: "monad", tier: "B_SHADOW", category: "NEW_LAUNCH" }),
  createAcceptanceSample({ sampleId: "sui-001", chain: "sui", tier: "B_SHADOW", category: "ESTABLISHED" }),
  createAcceptanceSample({ sampleId: "arbitrum-001", chain: "arbitrum", tier: "C_DISCOVERY", category: "HIGH_VOLUME" }),
  createAcceptanceSample({ sampleId: "polygon-001", chain: "polygon", tier: "C_DISCOVERY", category: "SUSPICIOUS_RISKY" }),
]);
