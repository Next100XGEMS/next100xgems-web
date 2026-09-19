import "server-only";

import { createClient as createSupabaseClient, type SupabaseClient } from "@supabase/supabase-js";
import { deepLaneOutputPayload, type RadarDeepLaneRequest, type RadarDeepLaneResult } from "@/lib/radar/deep-lane";
import type { RadarFastLaneResult, RadarNormalizedObservation } from "@/lib/radar/contracts";

export class RadarSystemGatewayError extends Error { constructor(message: string) { super(message); this.name = "RadarSystemGatewayError"; } }
export type RadarClaimedWork = { workItemId: string; workKind: string; tokenId: string | null; leaseToken: string; leaseGeneration: number; pauseGeneration: number; worker: string };
export type RadarSealedManifest = { workItemId: string; tokenId: string | null; reservedAnalysisVersion: number | null; methodVersion: string | null; inputVersion: string | null; sealedInputHash: string; sealedAt: string; pauseGeneration: number; inputManifest: readonly { observation_id: string; content_hash: string }[] };
export type RadarDeepLaneReservation = {
  requestId: string;
  requestHash: string;
  requestState: "IN_PROGRESS" | "SUCCEEDED" | "FAILED_RETRYABLE" | "FAILED_TERMINAL" | "UNCERTAIN";
  attemptId: string;
  attemptNumber: number;
  attemptState: "INVOKING" | "SUCCEEDED" | "FAILED_RETRYABLE" | "FAILED_TERMINAL" | "UNCERTAIN";
  invocationOwner: boolean;
  providerIdempotencyKey: string;
  pauseGeneration: number;
  completionOutput: unknown | null;
  completionOutputHash: string | null;
};

export type RadarSystemGateway = {
  insertEvent(input: { eventKey: string; eventType: string; tokenId: string | null; sourceProvider: string; sourceEventId: string | null; payloadHash: string; context: Record<string, unknown>; observedAt: string }): Promise<string>;
  recordObservation(input: { eventId: string; tokenId: string | null; observation: RadarNormalizedObservation }): Promise<string>;
  enqueueWork(input: { requestKey: string; workKind: string; tokenId: string | null; eventId: string | null; parentAnalysisId: string | null; methodVersion: string | null; inputVersion: string | null; availableAt?: string }): Promise<string>;
  attachObservation(workItemId: string, observationId: string): Promise<void>;
  finalizeWorkInputs(workItemId: string, methodVersion: string, inputVersion: string): Promise<RadarSealedManifest>;
  claimWork(worker: string, leaseSeconds?: number): Promise<RadarClaimedWork | null>;
  getWorkManifest(input: { workItemId: string; worker: string; leaseToken: string; leaseGeneration: number }): Promise<RadarSealedManifest>;
  completeScreening(input: { workItemId: string; worker: string; leaseToken: string; leaseGeneration: number; result: RadarFastLaneResult }): Promise<string>;
  renewWork(input: { workItemId: string; worker: string; leaseToken: string; leaseGeneration: number; leaseSeconds?: number }): Promise<boolean>;
  failWork(input: { workItemId: string; worker: string; leaseToken: string; leaseGeneration: number; retryable: boolean; summary: string; retryAt?: string }): Promise<string>;
};

export type RadarDeepLaneGateway = {
  getWorkManifest(input: { workItemId: string; worker: string; leaseToken: string; leaseGeneration: number }): Promise<RadarSealedManifest>;
  reserveDeepLaneAttempt(input: { claimed: RadarClaimedWork; request: RadarDeepLaneRequest; maxAttempts: number; explicitRetry: boolean }): Promise<RadarDeepLaneReservation>;
  completeDeepLaneAttempt(input: { claimed: RadarClaimedWork; request: RadarDeepLaneRequest; reservation: RadarDeepLaneReservation; result: RadarDeepLaneResult }): Promise<RadarDeepLaneResult>;
  failDeepLaneAttempt(input: { claimed: RadarClaimedWork; reservation: RadarDeepLaneReservation; retryable: boolean; errorCode: string; summary: string; invocationState: "NOT_INVOKED" | "COMPLETED_INVALID" }): Promise<string>;
  markDeepLaneUncertain(input: { claimed: RadarClaimedWork; reservation: RadarDeepLaneReservation; errorCode: string; summary: string }): Promise<string>;
};

let client: SupabaseClient | null | undefined;
function getClient(): SupabaseClient { if (client) return client; if (client === null) throw new RadarSystemGatewayError("Radar system credentials are not configured."); const url = process.env.SUPABASE_URL, secret = process.env.SUPABASE_SECRET_KEY; client = url && secret ? createSupabaseClient(url, secret, { auth: { autoRefreshToken: false, detectSessionInUrl: false, persistSession: false } }) : null; if (!client) throw new RadarSystemGatewayError("Radar system credentials are not configured."); return client; }
async function rpc<T>(name: string, args: Record<string, unknown>) { const { data, error } = await getClient().rpc(name, args); if (error) throw new RadarSystemGatewayError(`Radar system operation ${name} failed.`); return data as T; }
function first<T>(rows: T[] | null): T { const row = rows?.[0]; if (!row) throw new RadarSystemGatewayError("Radar system returned no manifest."); return row; }
function manifest(row: Record<string, unknown>): RadarSealedManifest { return { workItemId: String(row.work_item_id), tokenId: row.token_id ? String(row.token_id) : null, reservedAnalysisVersion: typeof row.reserved_analysis_version === "number" ? row.reserved_analysis_version : null, methodVersion: row.method_version ? String(row.method_version) : null, inputVersion: row.input_version ? String(row.input_version) : null, sealedInputHash: String(row.sealed_input_hash), sealedAt: String(row.sealed_at), pauseGeneration: Number(row.pause_generation), inputManifest: Array.isArray(row.input_manifest) ? row.input_manifest as RadarSealedManifest["inputManifest"] : [] }; }
function reservation(row: Record<string, unknown>): RadarDeepLaneReservation { return { requestId: String(row.request_id), requestHash: String(row.logical_request_hash), requestState: String(row.request_state) as RadarDeepLaneReservation["requestState"], attemptId: String(row.attempt_id), attemptNumber: Number(row.attempt_number), attemptState: String(row.attempt_state) as RadarDeepLaneReservation["attemptState"], invocationOwner: row.invocation_owner === true, providerIdempotencyKey: String(row.provider_idempotency_key), pauseGeneration: Number(row.pause_generation), completionOutput: row.completion_output ?? null, completionOutputHash: row.completion_output_hash ? String(row.completion_output_hash) : null }; }

export function createRadarSystemGateway(): RadarSystemGateway & RadarDeepLaneGateway { return {
  insertEvent: (i) => rpc("radar_system_insert_event", { p_event_key: i.eventKey, p_event_type: i.eventType, p_token_id: i.tokenId, p_source_provider: i.sourceProvider, p_source_event_id: i.sourceEventId, p_payload_hash: i.payloadHash, p_context: i.context, p_observed_at: i.observedAt }),
  recordObservation: (i) => rpc("radar_system_record_observation", { p_event_id: i.eventId, p_token_id: i.tokenId, p_provider: i.observation.provider, p_adapter_version: i.observation.adapterVersion, p_capability: i.observation.capability, p_metric_key: i.observation.metricKey, p_data_state: i.observation.state, p_normalized_value: i.observation.value, p_raw_integer_value: i.observation.rawIntegerValue, p_decimal_places: i.observation.decimalPlaces, p_unit: i.observation.unit, p_context: i.observation.context, p_provenance: i.observation.provenance, p_trace_reference: i.observation.traceReference, p_content_hash: i.observation.contentHash, p_observed_at: i.observation.observedAt }),
  enqueueWork: (i) => rpc("radar_system_enqueue_work", { p_request_key: i.requestKey, p_work_kind: i.workKind, p_token_id: i.tokenId, p_event_id: i.eventId, p_parent_analysis_id: i.parentAnalysisId, p_method_version: i.methodVersion, p_input_version: i.inputVersion, p_available_at: i.availableAt ?? null }),
  attachObservation: async (workItemId, observationId) => { await rpc("radar_system_attach_observation", { p_work_item_id: workItemId, p_observation_id: observationId }); },
  finalizeWorkInputs: async (workItemId, methodVersion, inputVersion) => manifest(first(await rpc<Record<string, unknown>[]>("radar_system_finalize_work_inputs", { p_work_item_id: workItemId, p_method_version: methodVersion, p_input_version: inputVersion }))),
  claimWork: async (worker, leaseSeconds = 300) => { const rows = await rpc<Array<{ work_item_id: string; work_kind: string; token_id: string | null; lease_token: string; lease_generation: number; pause_generation: number }>>("radar_system_claim_work", { p_worker: worker, p_lease_seconds: leaseSeconds }); const row = rows?.[0]; return row ? { workItemId: row.work_item_id, workKind: row.work_kind, tokenId: row.token_id, leaseToken: row.lease_token, leaseGeneration: row.lease_generation, pauseGeneration: row.pause_generation, worker } : null; },
  getWorkManifest: async (i) => manifest(first(await rpc<Record<string, unknown>[]>("radar_system_get_work_manifest", { p_work_item_id: i.workItemId, p_worker: i.worker, p_lease_token: i.leaseToken, p_lease_generation: i.leaseGeneration }))),
  completeScreening: (i) => rpc("radar_system_complete_screening", { p_work_item_id: i.workItemId, p_worker: i.worker, p_lease_token: i.leaseToken, p_lease_generation: i.leaseGeneration, p_result: i.result.result, p_reasons: i.result.reasons, p_input_hash: i.result.inputHash, p_evaluated_at: i.result.evaluatedAt }),
  renewWork: (i) => rpc("radar_system_renew_work", { p_work_item_id: i.workItemId, p_worker: i.worker, p_lease_token: i.leaseToken, p_lease_generation: i.leaseGeneration, p_lease_seconds: i.leaseSeconds ?? 300 }),
  failWork: (i) => rpc("radar_system_fail_work", { p_work_item_id: i.workItemId, p_worker: i.worker, p_lease_token: i.leaseToken, p_lease_generation: i.leaseGeneration, p_retryable: i.retryable, p_error_summary: i.summary, p_retry_at: i.retryAt ?? null }),
  reserveDeepLaneAttempt: async (i) => reservation(first(await rpc<Record<string, unknown>[]>("radar_system_reserve_deep_lane_attempt", { p_work_item_id: i.claimed.workItemId, p_worker: i.claimed.worker, p_lease_token: i.claimed.leaseToken, p_lease_generation: i.claimed.leaseGeneration, p_task_type: i.request.taskType, p_method_version: i.request.methodVersion, p_input_version: i.request.inputVersion, p_schema_version: i.request.schemaVersion, p_output_schema_version: i.request.outputSchemaVersion, p_input_manifest: i.request.inputManifest, p_evidence_manifest: i.request.evidence, p_provider: i.request.provider, p_model: i.request.model, p_model_revision: i.request.modelRevision, p_adapter_version: i.request.adapterVersion, p_max_attempts: i.maxAttempts, p_explicit_retry: i.explicitRetry }))),
  completeDeepLaneAttempt: async (i) => { const rows = await rpc<Record<string, unknown>[]>("radar_system_complete_deep_lane_attempt", { p_request_id: i.reservation.requestId, p_attempt_id: i.reservation.attemptId, p_work_item_id: i.claimed.workItemId, p_worker: i.claimed.worker, p_lease_token: i.claimed.leaseToken, p_lease_generation: i.claimed.leaseGeneration, p_pause_generation: i.reservation.pauseGeneration, p_request_hash: i.request.requestHash, p_attempt_number: i.reservation.attemptNumber, p_output: deepLaneOutputPayload(i.result), p_output_hash: i.result.outputHash }); const row = first(rows); return row.output_hash === i.result.outputHash ? i.result : { ...i.result, outputHash: String(row.output_hash) }; },
  failDeepLaneAttempt: (i) => rpc("radar_system_fail_deep_lane_attempt", { p_request_id: i.reservation.requestId, p_attempt_id: i.reservation.attemptId, p_work_item_id: i.claimed.workItemId, p_worker: i.claimed.worker, p_lease_token: i.claimed.leaseToken, p_lease_generation: i.claimed.leaseGeneration, p_pause_generation: i.reservation.pauseGeneration, p_retryable: i.retryable, p_error_code: i.errorCode, p_error_summary: i.summary, p_invocation_state: i.invocationState }),
  markDeepLaneUncertain: (i) => rpc("radar_system_mark_deep_lane_uncertain", { p_request_id: i.reservation.requestId, p_attempt_id: i.reservation.attemptId, p_work_item_id: i.claimed.workItemId, p_worker: i.claimed.worker, p_lease_token: i.claimed.leaseToken, p_lease_generation: i.claimed.leaseGeneration, p_pause_generation: i.reservation.pauseGeneration, p_error_code: i.errorCode, p_error_summary: i.summary }),
}; }
