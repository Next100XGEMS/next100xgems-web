import type { AcceptanceChain, AcceptanceCollectionRecord } from "@/lib/radar/acceptance/contracts";

export type ChainActivitySummary = { chain: AcceptanceChain; samples: number; discovered: number; availableRecords: number; missingRecords: number; staleRecords: number; providerCount: number; capabilityCount: number; status: "PROMOTE" | "SHADOW" | "WATCH_ONLY" | "DEFER" | "UNASSESSED" };

export function summarizeChainActivity(chain: AcceptanceChain, records: readonly AcceptanceCollectionRecord[]): ChainActivitySummary {
  const selected = records.filter((record) => record.chain === chain);
  const sampleIds = new Set(selected.map((record) => record.sampleId));
  const available = selected.filter((record) => record.normalized?.state === "AVAILABLE").length;
  const missing = selected.filter((record) => record.normalized?.state !== "AVAILABLE").length;
  const stale = selected.filter((record) => record.normalized?.state === "STALE").length;
  const coverage = selected.length === 0 ? 0 : available / selected.length;
  const status = selected.length === 0 ? "UNASSESSED" : coverage >= 0.8 && stale === 0 ? "PROMOTE" : coverage >= 0.5 ? "SHADOW" : coverage > 0 ? "WATCH_ONLY" : "DEFER";
  return { chain, samples: sampleIds.size, discovered: sampleIds.size, availableRecords: available, missingRecords: missing, staleRecords: stale, providerCount: new Set(selected.map((record) => record.provider)).size, capabilityCount: new Set(selected.map((record) => record.capability)).size, status };
}
