import { compareDecimals } from "@/lib/radar/decimal";
import type { AcceptanceCollectionRecord, AcceptanceComparison } from "@/lib/radar/acceptance/contracts";

export function compareAcceptanceRecords(left: AcceptanceCollectionRecord, right: AcceptanceCollectionRecord): AcceptanceComparison {
  if (left.chain !== right.chain || left.sampleId !== right.sampleId || left.capability !== right.capability || left.metricKey !== right.metricKey) throw new Error("Acceptance comparisons require the same sample, chain, capability and metric.");
  const leftValue = left.normalized?.value ?? null;
  const rightValue = right.normalized?.value ?? null;
  const status = left.normalized?.state === "STALE" || right.normalized?.state === "STALE" ? "STALE" : leftValue === null || rightValue === null ? "MISSING" : compareDecimals(leftValue, rightValue) === 0 ? "AGREEMENT" : "DISAGREEMENT";
  return { chain: left.chain, sampleId: left.sampleId, capability: left.capability, metricKey: left.metricKey, leftProvider: left.provider, rightProvider: right.provider, status, leftValue, rightValue, reason: status === "AGREEMENT" ? "Exact normalized decimal values agree." : status === "DISAGREEMENT" ? "Values are retained independently; no averaging or favorable-value selection is performed." : status === "STALE" ? "At least one source is stale." : "At least one source did not provide an available value." };
}
