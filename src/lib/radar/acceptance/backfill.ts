import { sha256 } from "@/lib/radar/hash";
import type { HistoricalCutoff } from "@/lib/radar/acceptance/corpus";

export type HistoricalCheckpoint = { cutoff: HistoricalCutoff; cutoffAt: string; inputManifestHash: string; available: boolean; state: "REPLAYABLE" | "NOT_RECONSTRUCTABLE"; reason: string };
export type HistoricalBackfillCall = { method: "getTransactionsForAddress" | "getTransfersByAddress" | "parsed-events"; calls: number; estimatedCredits: number | null; rows: number; errorCode: string | null };

const CUTOFF_MINUTES: Record<HistoricalCutoff, number> = { "T+5M": 5, "T+15M": 15, "T+30M": 30, "T+1H": 60, "T+6H": 360, "T+24H": 1440 };

/** Creates a point-in-time checkpoint and rejects future observations as leakage. */
export function createHistoricalCheckpoints(input: { launchObservedAt: string; observations: readonly { observedAt: string; source: string; value: unknown }[]; cutoffs?: readonly HistoricalCutoff[] }): readonly HistoricalCheckpoint[] {
  const launch = Date.parse(input.launchObservedAt); if (!Number.isFinite(launch)) throw new Error("launchObservedAt must be a valid timestamp.");
  return (input.cutoffs ?? Object.keys(CUTOFF_MINUTES) as HistoricalCutoff[]).map((cutoff) => {
    const cutoffAt = new Date(launch + CUTOFF_MINUTES[cutoff] * 60_000).toISOString();
    const eligible = input.observations.filter((observation) => Date.parse(observation.observedAt) <= Date.parse(cutoffAt));
    if (eligible.length === 0) return { cutoff, cutoffAt, inputManifestHash: sha256({ cutoff, cutoffAt, observations: [] }), available: false, state: "NOT_RECONSTRUCTABLE", reason: "No observation was available by the historical cutoff." };
    return { cutoff, cutoffAt, inputManifestHash: sha256({ cutoff, cutoffAt, observations: eligible.map((observation) => ({ observedAt: observation.observedAt, source: observation.source, value: observation.value })) }), available: true, state: "REPLAYABLE", reason: "Only observations at or before the cutoff were included." };
  });
}

export function summarizeHistoricalCalls(calls: readonly HistoricalBackfillCall[]) { return { calls: calls.reduce((sum, item) => sum + item.calls, 0), estimatedCredits: calls.every((item) => item.estimatedCredits === null) ? null : calls.reduce((sum, item) => sum + (item.estimatedCredits ?? 0), 0), rows: calls.reduce((sum, item) => sum + item.rows, 0), errors: calls.filter((item) => item.errorCode !== null).length }; }
