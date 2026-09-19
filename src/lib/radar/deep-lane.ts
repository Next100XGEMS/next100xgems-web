import { sha256 } from "@/lib/radar/hash";
import { sanitizeRadarProviderError, type RadarProviderErrorCode } from "@/lib/radar/errors";
import type { RadarClaimedWork, RadarDeepLaneGateway, RadarSealedManifest } from "@/lib/radar/system-gateway";

export type RadarDeepLaneEvidenceInput = { evidenceId: string; contentHash: string; classification: "VERIFIED_DATA" | "STRONG_SIGNAL" | "UNKNOWN"; statement: string };
export type RadarDeepLaneInputManifest = { observation_id: string; content_hash: string };
export type RadarDeepLaneRequest = {
  schemaVersion: "deep-lane-request-v2";
  workItemId: string;
  tokenId: string;
  reservedAnalysisVersion: number;
  taskType: "DEEP_ANALYSIS";
  methodVersion: string;
  inputVersion: string;
  inputManifest: readonly RadarDeepLaneInputManifest[];
  frozenInputHash: string;
  evidence: readonly RadarDeepLaneEvidenceInput[];
  provider: string;
  model: string;
  modelRevision: string | null;
  adapterVersion: string;
  outputSchemaVersion: "deep-lane-output-v1";
  requestHash: string;
};
export type RadarDeepLaneInvocation = { requestHash: string; attemptId: string; attemptNumber: number; providerIdempotencyKey: string; supportsIdempotencyKey: boolean };
export type RadarDeepLaneInference = { key: string; label: string; statement: string; uncertainty: string; evidenceIds: readonly string[]; classification: "AI_INFERENCE"; origin: "INFERENCE" };
export type RadarDeepLaneResult = { schemaVersion: "deep-lane-output-v1"; provider: string; model: string; modelRevision: string | null; requestHash: string; generatedAt: string; inferences: readonly RadarDeepLaneInference[]; outputHash: string };
export type RadarDeepLaneAdapter = { readonly provider: string; readonly model: string; readonly modelRevision?: string; readonly adapterVersion: string; readonly supportsIdempotencyKey: boolean; request(input: RadarDeepLaneRequest, invocation?: RadarDeepLaneInvocation): Promise<unknown> };
export type RadarDeepLaneFailure = { kind: "TRANSIENT" | "PERMANENT"; code: RadarProviderErrorCode | "PROVIDER_FAILED"; summary: string; attempt: number };

export class RadarDeepLaneValidationError extends Error { constructor(message: string) { super(message); this.name = "RadarDeepLaneValidationError"; } }
export class RadarDeepLaneProviderError extends Error { constructor(public readonly code: RadarProviderErrorCode, message: string, public readonly executionState: "NOT_INVOKED" | "UNKNOWN") { super(message); this.name = "RadarDeepLaneProviderError"; } }
export class RadarDeepLaneInProgressError extends Error { constructor(message = "Deep Lane request is already owned by another durable attempt.") { super(message); this.name = "RadarDeepLaneInProgressError"; } }

const ID = /^[A-Za-z0-9][A-Za-z0-9._:-]{0,127}$/;
const HASH = /^[0-9a-f]{64}$/;
function safeText(value: unknown, label: string, max: number) { if (typeof value !== "string" || value.length === 0 || value.length > max || /[<>\u0000-\u001f]/.test(value)) throw new RadarDeepLaneValidationError(`${label} is not safe.`); return value; }
function safeHash(value: unknown, label: string) { const result = safeText(value, label, 128); if (!HASH.test(result)) throw new RadarDeepLaneValidationError(`${label} must be a SHA-256 hash.`); return result; }
function object(value: unknown): Record<string, unknown> { if (!value || typeof value !== "object" || Array.isArray(value)) throw new RadarDeepLaneValidationError("Deep Lane output must be an object."); return value as Record<string, unknown>; }
function timestamp(value: unknown) { const result = safeText(value, "generatedAt", 64); if (!Number.isFinite(Date.parse(result))) throw new RadarDeepLaneValidationError("generatedAt must be an ISO timestamp."); return new Date(result).toISOString(); }
function requestIdentity(input: Omit<RadarDeepLaneRequest, "requestHash">) { return { identity_version: "deep-lane-request-v2", work_item_id: input.workItemId, token_id: input.tokenId, reserved_analysis_version: input.reservedAnalysisVersion, task_type: input.taskType, method_version: input.methodVersion, input_version: input.inputVersion, schema_version: input.schemaVersion, output_schema_version: input.outputSchemaVersion, frozen_input_hash: input.frozenInputHash, input_manifest: input.inputManifest, evidence: input.evidence, provider: input.provider, model: input.model, model_revision: input.modelRevision, adapter_version: input.adapterVersion }; }
function requestFingerprint(input: Omit<RadarDeepLaneRequest, "requestHash">) { return sha256(requestIdentity(input)); }
function outputPayload(result: RadarDeepLaneResult) { const { outputHash, ...payload } = result; void outputHash; return payload; }

export function deepLaneOutputPayload(result: RadarDeepLaneResult) { return outputPayload(result); }

export function prepareDeepLaneRequest(input: { workItemId: string; tokenId: string; reservedAnalysisVersion: number; methodVersion: string; inputVersion: string; inputManifest: readonly RadarDeepLaneInputManifest[]; evidence: readonly RadarDeepLaneEvidenceInput[]; provider: string; model: string; modelRevision?: string; adapterVersion: string; frozenInputHash: string }): RadarDeepLaneRequest {
  const workItemId = safeText(input.workItemId, "workItemId", 128); const tokenId = safeText(input.tokenId, "tokenId", 128); const methodVersion = safeText(input.methodVersion, "methodVersion", 64); const inputVersion = safeText(input.inputVersion, "inputVersion", 64); const provider = safeText(input.provider, "provider", 64); const model = safeText(input.model, "model", 128); const adapterVersion = safeText(input.adapterVersion, "adapterVersion", 128); const frozenInputHash = safeHash(input.frozenInputHash, "frozenInputHash");
  if (!Number.isInteger(input.reservedAnalysisVersion) || input.reservedAnalysisVersion <= 0) throw new RadarDeepLaneValidationError("reservedAnalysisVersion must be a positive integer.");
  const inputManifest = [...input.inputManifest].sort((left, right) => left.observation_id.localeCompare(right.observation_id)).map((item) => ({ observation_id: safeText(item.observation_id, "observation_id", 128), content_hash: safeHash(item.content_hash, "content_hash") }));
  if (inputManifest.length === 0) throw new RadarDeepLaneValidationError("Deep Lane requires a sealed input manifest.");
  const seen = new Set<string>();
  const evidence = [...input.evidence].sort((left, right) => left.evidenceId.localeCompare(right.evidenceId)).map((item) => { const evidenceId = safeText(item.evidenceId, "evidenceId", 128); if (!ID.test(evidenceId) || seen.has(evidenceId)) throw new RadarDeepLaneValidationError("Deep Lane evidence identifiers must be unique and bounded."); seen.add(evidenceId); if (!["VERIFIED_DATA", "STRONG_SIGNAL", "UNKNOWN"].includes(item.classification)) throw new RadarDeepLaneValidationError("Deep Lane evidence classification is invalid."); return { evidenceId, contentHash: safeHash(item.contentHash, "contentHash"), classification: item.classification, statement: safeText(item.statement, "evidence statement", 2000) }; });
  if (evidence.length === 0) throw new RadarDeepLaneValidationError("Deep Lane requires a sealed evidence manifest.");
  const base = { schemaVersion: "deep-lane-request-v2" as const, workItemId, tokenId, reservedAnalysisVersion: input.reservedAnalysisVersion, taskType: "DEEP_ANALYSIS" as const, methodVersion, inputVersion, inputManifest, frozenInputHash, evidence, provider, model, modelRevision: input.modelRevision === undefined ? null : safeText(input.modelRevision, "modelRevision", 128), adapterVersion, outputSchemaVersion: "deep-lane-output-v1" as const };
  return Object.freeze({ ...base, requestHash: requestFingerprint(base) });
}

export function validateDeepLaneOutput(raw: unknown, request: RadarDeepLaneRequest, trustedIdentity?: { provider: string; model: string; modelRevision?: string; adapterVersion?: string }): RadarDeepLaneResult {
  if (requestFingerprint(request) !== request.requestHash) throw new RadarDeepLaneValidationError("Deep Lane request manifest was changed after sealing.");
  const value = object(raw); if (value.schemaVersion !== request.outputSchemaVersion) throw new RadarDeepLaneValidationError("Unsupported Deep Lane output schema.");
  const provider = safeText(value.provider, "provider", 64); const model = safeText(value.model, "model", 128); const modelRevision = value.modelRevision === null || value.modelRevision === undefined ? null : safeText(value.modelRevision, "modelRevision", 128);
  if (trustedIdentity && (provider !== trustedIdentity.provider || model !== trustedIdentity.model || (trustedIdentity.modelRevision !== undefined && modelRevision !== trustedIdentity.modelRevision) || (trustedIdentity.adapterVersion !== undefined && request.adapterVersion !== trustedIdentity.adapterVersion))) throw new RadarDeepLaneValidationError("Deep Lane output identity does not match the trusted adapter.");
  const outputRequestHash = safeHash(value.requestHash, "requestHash"); if (outputRequestHash !== request.requestHash) throw new RadarDeepLaneValidationError("Deep Lane output is not bound to the durable request hash.");
  const generatedAt = timestamp(value.generatedAt); if (!Array.isArray(value.inferences) || value.inferences.length > 32) throw new RadarDeepLaneValidationError("Deep Lane inferences must be a bounded array.");
  const allowed = new Set(request.evidence.map((item) => item.evidenceId)); const keys = new Set<string>();
  const inferences = value.inferences.map((item) => { const inference = object(item); const key = safeText(inference.key, "inference key", 96); if (keys.has(key)) throw new RadarDeepLaneValidationError("Deep Lane inference keys must be unique."); keys.add(key); const label = safeText(inference.label, "inference label", 160); const statement = safeText(inference.statement, "inference statement", 2000); const uncertainty = safeText(inference.uncertainty, "inference uncertainty", 500); if (!Array.isArray(inference.evidenceIds) || inference.evidenceIds.length === 0 || inference.evidenceIds.length > 16) throw new RadarDeepLaneValidationError("Every inference requires bounded evidence references."); const evidenceIds = inference.evidenceIds.map((id) => safeText(id, "inference evidence id", 128)); if (new Set(evidenceIds).size !== evidenceIds.length || evidenceIds.some((id) => !allowed.has(id))) throw new RadarDeepLaneValidationError("Deep Lane referenced evidence outside the sealed manifest."); return { key, label, statement, uncertainty, evidenceIds, classification: "AI_INFERENCE" as const, origin: "INFERENCE" as const }; });
  const result = { schemaVersion: request.outputSchemaVersion, provider, model, modelRevision, requestHash: outputRequestHash, generatedAt, inferences } as const;
  return { ...result, outputHash: sha256(result) };
}

export function classifyDeepLaneFailure(input: { error: unknown; attempt: number; maxAttempts: number }): RadarDeepLaneFailure { const safe = sanitizeRadarProviderError(input.error); return { kind: safe.retryable && input.attempt < input.maxAttempts ? "TRANSIENT" : "PERMANENT", code: safe.retryable && input.attempt < input.maxAttempts ? safe.code : "PROVIDER_FAILED", summary: `${safe.code}: ${safe.summary}`, attempt: input.attempt }; }

export async function executeDeepLane(adapter: RadarDeepLaneAdapter, request: RadarDeepLaneRequest, invocation?: RadarDeepLaneInvocation): Promise<RadarDeepLaneResult> { const raw = await adapter.request(request, invocation); return validateDeepLaneOutput(raw, request, { provider: adapter.provider, model: adapter.model, modelRevision: adapter.modelRevision, adapterVersion: adapter.adapterVersion }); }

export async function executeDeepLaneWork(input: { claimed: RadarClaimedWork; request: RadarDeepLaneRequest; adapter: RadarDeepLaneAdapter; gateway: RadarDeepLaneGateway; maxAttempts?: number; explicitRetry?: boolean }): Promise<RadarDeepLaneResult> {
  const manifest = await input.gateway.getWorkManifest({ workItemId: input.claimed.workItemId, worker: input.claimed.worker, leaseToken: input.claimed.leaseToken, leaseGeneration: input.claimed.leaseGeneration });
  if (manifest.workItemId !== input.request.workItemId || manifest.tokenId !== input.request.tokenId || manifest.reservedAnalysisVersion !== input.request.reservedAnalysisVersion || manifest.methodVersion !== input.request.methodVersion || manifest.inputVersion !== input.request.inputVersion || manifest.sealedInputHash !== input.request.frozenInputHash || sha256(manifest.inputManifest) !== sha256(input.request.inputManifest)) throw new RadarDeepLaneValidationError("Deep Lane request does not match the fenced sealed work manifest.");
  const reservation = await input.gateway.reserveDeepLaneAttempt({ claimed: input.claimed, request: input.request, maxAttempts: input.maxAttempts ?? 3, explicitRetry: input.explicitRetry ?? false });
  const trusted = { provider: input.adapter.provider, model: input.adapter.model, modelRevision: input.adapter.modelRevision, adapterVersion: input.adapter.adapterVersion };
  if (reservation.requestState === "SUCCEEDED") {
    if (!reservation.completionOutput || !reservation.completionOutputHash) throw new RadarDeepLaneValidationError("Deep Lane completion receipt is incomplete.");
    const replay = validateDeepLaneOutput(reservation.completionOutput, input.request, trusted);
    if (replay.outputHash !== reservation.completionOutputHash) throw new RadarDeepLaneValidationError("Deep Lane completion receipt hash does not match the validated output.");
    return replay;
  }
  if (!reservation.invocationOwner) throw new RadarDeepLaneInProgressError();
  let raw: unknown;
  try {
    raw = await input.adapter.request(input.request, { requestHash: input.request.requestHash, attemptId: reservation.attemptId, attemptNumber: reservation.attemptNumber, providerIdempotencyKey: reservation.providerIdempotencyKey, supportsIdempotencyKey: input.adapter.supportsIdempotencyKey });
  } catch (error) {
    const safe = sanitizeRadarProviderError(error); const providerError = error instanceof RadarDeepLaneProviderError ? error : null;
    if (providerError?.executionState === "NOT_INVOKED") { const failure = classifyDeepLaneFailure({ error, attempt: reservation.attemptNumber, maxAttempts: input.maxAttempts ?? 3 }); await input.gateway.failDeepLaneAttempt({ claimed: input.claimed, reservation, retryable: failure.kind === "TRANSIENT", errorCode: failure.code, summary: failure.summary, invocationState: "NOT_INVOKED" }); }
    else await input.gateway.markDeepLaneUncertain({ claimed: input.claimed, reservation, errorCode: safe.code, summary: `${safe.code}: ${safe.summary}` });
    throw error;
  }
  let result: RadarDeepLaneResult;
  try { result = validateDeepLaneOutput(raw, input.request, trusted); }
  catch (error) { const safe = sanitizeRadarProviderError(error); await input.gateway.failDeepLaneAttempt({ claimed: input.claimed, reservation, retryable: false, errorCode: "INVALID_OUTPUT", summary: `${safe.code}: ${safe.summary}`, invocationState: "COMPLETED_INVALID" }); throw error; }
  return input.gateway.completeDeepLaneAttempt({ claimed: input.claimed, request: input.request, reservation, result });
}

export type RadarClaimedDeepLaneWork = RadarClaimedWork;
export type RadarDeepLaneManifest = RadarSealedManifest;
