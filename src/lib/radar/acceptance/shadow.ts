import { sha256 } from "@/lib/radar/hash";

export const SHADOW_CHECKPOINTS = ["T+5M", "T+15M", "T+30M", "T+1H", "T+6H", "T+24H"] as const;
export type ShadowCheckpointName = (typeof SHADOW_CHECKPOINTS)[number];
export type ShadowCheckpointStatus = "PENDING" | "CAPTURED" | "MISSED";
export type ShadowObservationState = "AVAILABLE" | "UNKNOWN" | "UNAVAILABLE" | "STALE" | "NOT_APPLICABLE";

export type ShadowAdmission = {
  mint: string;
  creator: string | null;
  creationSignature: string;
  creationSlot: number;
  creationTimestamp: string;
  bondingCurveAddress: string;
  decoderVersion: string;
  admissionTimestamp: string;
  selectionReason: string;
};

export type ShadowObservation = {
  capability: "MARKET" | "LIQUIDITY" | "ACTIVITY" | "LIFECYCLE" | "HOLDERS" | "CREATOR";
  metric: string;
  state: ShadowObservationState;
  value: string | null;
  unit: string | null;
  source: string;
  sourceTimestamp: string | null;
  observedAt: string;
  provenance: { endpoint: string; reference: string | null; scope: string };
};

export type ShadowCheckpoint = {
  key: string;
  token: string;
  name: ShadowCheckpointName;
  checkpointAt: string;
  status: ShadowCheckpointStatus;
  capturedAt: string | null;
  manifestHash: string;
  observations: readonly ShadowObservation[];
  noLookAhead: boolean;
};

export type ShadowTelemetryEvent = { provider: string; capability: string; chain: "solana"; success: boolean; latencyMs: number; calls: number; credits: number | null; errorCode: string | null; observedAt: string };
export type ShadowCollectionState = { schemaVersion: "radar-solana-shadow-v1"; mode: "DEVELOPMENT_SHADOW"; createdAt: string; updatedAt: string; cohortTarget: number; admissions: readonly ShadowAdmission[]; checkpoints: readonly ShadowCheckpoint[]; telemetry: readonly ShadowTelemetryEvent[] };

const MINUTES: Record<ShadowCheckpointName, number> = { "T+5M": 5, "T+15M": 15, "T+30M": 30, "T+1H": 60, "T+6H": 360, "T+24H": 1440 };

export function createShadowCollectionState(input: { now: string; cohortTarget?: number }): ShadowCollectionState { return { schemaVersion: "radar-solana-shadow-v1", mode: "DEVELOPMENT_SHADOW", createdAt: input.now, updatedAt: input.now, cohortTarget: input.cohortTarget ?? 20, admissions: [], checkpoints: [], telemetry: [] }; }

export function admitShadowToken(state: ShadowCollectionState, admission: ShadowAdmission): ShadowCollectionState {
  if (state.admissions.some((item) => item.mint === admission.mint)) return state;
  return { ...state, updatedAt: admission.admissionTimestamp, admissions: [...state.admissions, { ...admission }] };
}

export function checkpointAt(admission: ShadowAdmission, name: ShadowCheckpointName): string { return new Date(Date.parse(admission.creationTimestamp) + MINUTES[name] * 60_000).toISOString(); }

export function dueShadowCheckpoints(state: ShadowCollectionState, now: string): readonly { admission: ShadowAdmission; name: ShadowCheckpointName; checkpointAt: string }[] {
  const completed = new Set(state.checkpoints.filter((checkpoint) => checkpoint.status === "CAPTURED").map((checkpoint) => checkpoint.key));
  return state.admissions.flatMap((admission) => SHADOW_CHECKPOINTS.flatMap((name) => { const at = checkpointAt(admission, name); const key = `${admission.mint}:${name}`; return Date.parse(at) <= Date.parse(now) && !completed.has(key) ? [{ admission, name, checkpointAt: at }] : []; }));
}

export function createShadowCheckpoint(input: { admission: ShadowAdmission; name: ShadowCheckpointName; capturedAt: string; observations: readonly ShadowObservation[]; status?: ShadowCheckpointStatus }): ShadowCheckpoint {
  const checkpointAtValue = checkpointAt(input.admission, input.name);
  const noLookAhead = input.observations.every((observation) => Date.parse(observation.observedAt) <= Date.parse(input.capturedAt));
  if (!noLookAhead) throw new Error("Shadow checkpoint contains an observation from the future.");
  return { key: `${input.admission.mint}:${input.name}`, token: input.admission.mint, name: input.name, checkpointAt: checkpointAtValue, status: input.status ?? "CAPTURED", capturedAt: input.capturedAt, manifestHash: sha256({ token: input.admission.mint, name: input.name, checkpointAt: checkpointAtValue, observations: input.observations }), observations: input.observations.map((observation) => ({ ...observation })), noLookAhead };
}

export function recordImmutableShadowCheckpoint(state: ShadowCollectionState, checkpoint: ShadowCheckpoint): ShadowCollectionState {
  const existing = state.checkpoints.find((item) => item.key === checkpoint.key);
  if (existing) {
    if (existing.manifestHash !== checkpoint.manifestHash || existing.status !== checkpoint.status) throw new Error("Shadow checkpoint is immutable and conflicts with the stored manifest.");
    return state;
  }
  return { ...state, updatedAt: checkpoint.capturedAt ?? state.updatedAt, checkpoints: [...state.checkpoints, checkpoint] };
}

export function appendShadowTelemetry(state: ShadowCollectionState, event: ShadowTelemetryEvent): ShadowCollectionState { return { ...state, updatedAt: event.observedAt, telemetry: [...state.telemetry, { ...event }] }; }

export function classifyShadowMarketStage(input: { lifecycleComplete: boolean | null; poolFound: boolean }): "PUMP_BONDING_CURVE_STAGE" | "DEX_POOL_STAGE" | "UNKNOWN" {
  if (input.poolFound) return "DEX_POOL_STAGE";
  if (input.lifecycleComplete === false) return "PUMP_BONDING_CURVE_STAGE";
  return "UNKNOWN";
}

export function summarizeShadowAvailability(state: ShadowCollectionState, metrics: readonly string[]): Record<string, { available: number; unknown: number; stale: number; providerFailure: number; notApplicable: number; total: number }> {
  return Object.fromEntries(metrics.map((metric) => {
    const observations = state.checkpoints.flatMap((checkpoint) => checkpoint.observations).filter((observation) => observation.metric === metric);
    return [metric, { available: observations.filter((item) => item.state === "AVAILABLE").length, unknown: observations.filter((item) => item.state === "UNKNOWN").length, stale: observations.filter((item) => item.state === "STALE").length, providerFailure: observations.filter((item) => item.state === "UNAVAILABLE").length, notApplicable: observations.filter((item) => item.state === "NOT_APPLICABLE").length, total: observations.length }];
  }));
}
