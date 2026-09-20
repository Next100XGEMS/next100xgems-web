import { sha256 } from "@/lib/radar/hash";

export const SHADOW_CHECKPOINTS = ["T+5M", "T+15M", "T+30M", "T+1H", "T+6H", "T+24H"] as const;
export type ShadowCheckpointName = (typeof SHADOW_CHECKPOINTS)[number];
export const SHADOW_CAPTURE_WINDOW_MS = 120_000;
export type ShadowCheckpointStatus = "PENDING_FUTURE" | "DUE_NOW" | "CAPTURED" | "MISSED_WINDOW";
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
export type ShadowCollectionState = { schemaVersion: "radar-solana-shadow-v1"; mode: "DEVELOPMENT_SHADOW"; createdAt: string; updatedAt: string; cohortTarget: number; admissionsFrozen?: boolean; admissions: readonly ShadowAdmission[]; checkpoints: readonly ShadowCheckpoint[]; telemetry: readonly ShadowTelemetryEvent[] };

const MINUTES: Record<ShadowCheckpointName, number> = { "T+5M": 5, "T+15M": 15, "T+30M": 30, "T+1H": 60, "T+6H": 360, "T+24H": 1440 };

export function createShadowCollectionState(input: { now: string; cohortTarget?: number }): ShadowCollectionState { return { schemaVersion: "radar-solana-shadow-v1", mode: "DEVELOPMENT_SHADOW", createdAt: input.now, updatedAt: input.now, cohortTarget: input.cohortTarget ?? 20, admissions: [], checkpoints: [], telemetry: [] }; }

export function admitShadowToken(state: ShadowCollectionState, admission: ShadowAdmission): ShadowCollectionState {
  if (state.admissionsFrozen) return state;
  if (state.admissions.some((item) => item.mint === admission.mint)) return state;
  return { ...state, updatedAt: admission.admissionTimestamp, admissions: [...state.admissions, { ...admission }] };
}

export function freezeShadowAdmissions(state: ShadowCollectionState, now: string): ShadowCollectionState { return state.admissionsFrozen ? state : { ...state, admissionsFrozen: true, updatedAt: now }; }

export function checkpointAt(admission: ShadowAdmission, name: ShadowCheckpointName): string { return new Date(Date.parse(admission.creationTimestamp) + MINUTES[name] * 60_000).toISOString(); }

export function resolveShadowCheckpointStatus(input: { checkpointAt: string; now: string; existing?: ShadowCheckpointStatus; captureWindowMs?: number }): ShadowCheckpointStatus {
  if (input.existing === "CAPTURED" || input.existing === "MISSED_WINDOW") return input.existing;
  const at = Date.parse(input.checkpointAt);
  const now = Date.parse(input.now);
  if (now < at) return "PENDING_FUTURE";
  if (now <= at + (input.captureWindowMs ?? SHADOW_CAPTURE_WINDOW_MS)) return "DUE_NOW";
  return "MISSED_WINDOW";
}

export function shadowCheckpointKey(admission: ShadowAdmission, name: ShadowCheckpointName): string { return `${admission.mint}:${name}`; }

export function syncShadowCheckpointStates(state: ShadowCollectionState, now: string, captureWindowMs = SHADOW_CAPTURE_WINDOW_MS): ShadowCollectionState {
  const existing = new Map(state.checkpoints.map((checkpoint) => [checkpoint.key, checkpoint]));
  const scheduled = state.admissions.flatMap((admission) => SHADOW_CHECKPOINTS.map((name) => {
    const key = shadowCheckpointKey(admission, name);
    const checkpointAtValue = checkpointAt(admission, name);
    const current = existing.get(key);
    if (current?.status === "CAPTURED") return current;
    const status = resolveShadowCheckpointStatus({ checkpointAt: checkpointAtValue, now, existing: (current?.status as string) === "MISSED" ? "MISSED_WINDOW" : current?.status, captureWindowMs });
    if (current && current.status === status) return current;
    return { key, token: admission.mint, name, checkpointAt: checkpointAtValue, status, capturedAt: null, manifestHash: sha256({ key, checkpointAt: checkpointAtValue, status }), observations: [], noLookAhead: true } satisfies ShadowCheckpoint;
  }));
  const scheduledKeys = new Set(scheduled.map((checkpoint) => checkpoint.key));
  return { ...state, checkpoints: [...scheduled, ...state.checkpoints.filter((checkpoint) => !scheduledKeys.has(checkpoint.key))] };
}

export function dueShadowCheckpoints(state: ShadowCollectionState, now: string): readonly { admission: ShadowAdmission; name: ShadowCheckpointName; checkpointAt: string; key: string }[] {
  const normalized = syncShadowCheckpointStates(state, now);
  const byKey = new Map(normalized.checkpoints.map((checkpoint) => [checkpoint.key, checkpoint]));
  return state.admissions.flatMap((admission) => SHADOW_CHECKPOINTS.flatMap((name) => { const at = checkpointAt(admission, name); const key = shadowCheckpointKey(admission, name); return byKey.get(key)?.status === "DUE_NOW" ? [{ admission, name, checkpointAt: at, key }] : []; }));
}

export function nextShadowCheckpoint(state: ShadowCollectionState, now: string): { admission: ShadowAdmission; name: ShadowCheckpointName; checkpointAt: string; status: ShadowCheckpointStatus } | null {
  const normalized = syncShadowCheckpointStates(state, now);
  return state.admissions.flatMap((admission) => SHADOW_CHECKPOINTS.map((name) => ({ admission, name, checkpointAt: checkpointAt(admission, name), status: normalized.checkpoints.find((checkpoint) => checkpoint.key === shadowCheckpointKey(admission, name))?.status ?? "PENDING_FUTURE" as ShadowCheckpointStatus }))).filter((item) => item.status === "DUE_NOW" || item.status === "PENDING_FUTURE").sort((a, b) => Date.parse(a.checkpointAt) - Date.parse(b.checkpointAt))[0] ?? null;
}

export function allShadowCheckpointsTerminal(state: ShadowCollectionState, now: string): boolean {
  if (!state.admissions.length) return false;
  const normalized = syncShadowCheckpointStates(state, now);
  return state.admissions.every((admission) => SHADOW_CHECKPOINTS.every((name) => { const status = normalized.checkpoints.find((checkpoint) => checkpoint.key === shadowCheckpointKey(admission, name))?.status; return status === "CAPTURED" || status === "MISSED_WINDOW"; }));
}

export function createShadowCheckpoint(input: { admission: ShadowAdmission; name: ShadowCheckpointName; capturedAt?: string | null; observations: readonly ShadowObservation[]; status?: "CAPTURED" | "MISSED_WINDOW" }): ShadowCheckpoint {
  const checkpointAtValue = checkpointAt(input.admission, input.name);
  const status = input.status ?? "CAPTURED";
  if (status === "CAPTURED" && !input.capturedAt) throw new Error("Captured shadow checkpoint requires a capture timestamp.");
  const noLookAhead = !input.capturedAt || input.observations.every((observation) => Date.parse(observation.observedAt) <= Date.parse(input.capturedAt!));
  if (!noLookAhead) throw new Error("Shadow checkpoint contains an observation from the future.");
  return { key: shadowCheckpointKey(input.admission, input.name), token: input.admission.mint, name: input.name, checkpointAt: checkpointAtValue, status, capturedAt: input.capturedAt ?? null, manifestHash: sha256({ token: input.admission.mint, name: input.name, checkpointAt: checkpointAtValue, status, observations: input.observations }), observations: input.observations.map((observation) => ({ ...observation })), noLookAhead };
}

export function recordImmutableShadowCheckpoint(state: ShadowCollectionState, checkpoint: ShadowCheckpoint): ShadowCollectionState {
  const existing = state.checkpoints.find((item) => item.key === checkpoint.key);
  if (existing) {
    if (existing.status === "CAPTURED" || existing.status === "MISSED_WINDOW") {
      if (existing.manifestHash !== checkpoint.manifestHash || existing.status !== checkpoint.status) throw new Error("Shadow checkpoint is immutable and conflicts with the stored manifest.");
      return state;
    }
    return { ...state, updatedAt: checkpoint.capturedAt ?? state.updatedAt, checkpoints: state.checkpoints.map((item) => item.key === checkpoint.key ? checkpoint : item) };
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
