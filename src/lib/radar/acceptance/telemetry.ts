import { sanitizeRadarProviderError } from "@/lib/radar/errors";
import type { AcceptanceCollectionRecord, AcceptanceProvider, AcceptanceUsageProjection } from "@/lib/radar/acceptance/contracts";

export type AcceptanceTelemetrySummary = {
  chain: string;
  provider: AcceptanceProvider;
  capability: string;
  records: number;
  successRate: string;
  missingnessRate: string;
  p50LatencyMs: number | null;
  p95LatencyMs: number | null;
  retries: number;
  responseBytes: number;
  expensiveEndpointCount: number;
  errorCategories: Record<string, number>;
};

function percentile(values: readonly number[], fraction: number): number | null {
  if (values.length === 0) return null;
  const ordered = [...values].sort((a, b) => a - b);
  return ordered[Math.min(ordered.length - 1, Math.ceil(ordered.length * fraction) - 1)] ?? null;
}

export class AcceptanceTelemetryStore {
  private readonly records: AcceptanceCollectionRecord[] = [];

  record(record: AcceptanceCollectionRecord) { this.records.push({ ...record }); }
  snapshot(): readonly AcceptanceCollectionRecord[] { return this.records.map((record) => ({ ...record })); }

  summaries(): readonly AcceptanceTelemetrySummary[] {
    const groups = new Map<string, AcceptanceCollectionRecord[]>();
    for (const record of this.records) {
      const key = `${record.chain}|${record.provider}|${record.capability}`;
      groups.set(key, [...(groups.get(key) ?? []), record]);
    }
    return [...groups.values()].map((records) => {
      const first = records[0];
      const successful = records.filter((record) => record.normalized?.state === "AVAILABLE").length;
      const missing = records.filter((record) => record.normalized?.state !== "AVAILABLE").length;
      const errors: Record<string, number> = {};
      for (const record of records) if (record.errorCode) errors[record.errorCode] = (errors[record.errorCode] ?? 0) + 1;
      return { chain: first.chain, provider: first.provider, capability: first.capability, records: records.length, successRate: (successful / records.length).toFixed(4), missingnessRate: (missing / records.length).toFixed(4), p50LatencyMs: percentile(records.map((record) => record.latencyMs), 0.5), p95LatencyMs: percentile(records.map((record) => record.latencyMs), 0.95), retries: records.reduce((sum, record) => sum + record.retryCount, 0), responseBytes: records.reduce((sum, record) => sum + (record.responseBytes ?? 0), 0), expensiveEndpointCount: records.filter((record) => record.expensiveEndpoint).length, errorCategories: errors };
    });
  }

  usageProjection(provider: AcceptanceProvider, chain?: string): AcceptanceUsageProjection {
    const records = this.records.filter((record) => record.provider === provider && (!chain || record.chain === chain));
    const callsPerSample = records.length === 0 ? "0" : (records.length / new Set(records.map((record) => record.sampleId)).size).toFixed(4);
    const units = records.map((record) => record.requestUnits).filter((value): value is string => value !== null);
    const unitsPerSample = units.length === 0 ? null : (units.reduce((sum, value) => sum + Number(value), 0) / units.length).toFixed(4);
    const scale = (count: number) => (Number(callsPerSample) * count).toFixed(2);
    const unitScale = (count: number) => unitsPerSample === null ? null : (Number(unitsPerSample) * count * Number(callsPerSample)).toFixed(2);
    return { callsPerSample, callsPerDay: { 100: scale(100), 1000: scale(1000), 10000: scale(10000) }, unitsPerSample, unitsPerDay: { 100: unitScale(100), 1000: unitScale(1000), 10000: unitScale(10000) }, measuredFromRecords: records.length };
  }
}

export function safeAcceptanceError(error: unknown) { return sanitizeRadarProviderError(error); }
