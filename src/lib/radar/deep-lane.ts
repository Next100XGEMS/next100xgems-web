import { sha256 } from "@/lib/radar/hash";
import { sanitizeRadarProviderError, type RadarProviderErrorCode } from "@/lib/radar/errors";
import type { RadarSystemGateway } from "@/lib/radar/system-gateway";

export type RadarDeepLaneEvidenceInput = { evidenceId: string; contentHash: string; classification: "VERIFIED_DATA" | "STRONG_SIGNAL" | "UNKNOWN"; statement: string };
export type RadarDeepLaneRequest = { schemaVersion: "deep-lane-request-v1"; tokenId: string; inputHash: string; frozenInputHash: string; evidence: readonly RadarDeepLaneEvidenceInput[]; promptTemplateVersion: string; promptTemplateHash: string; outputSchemaVersion: "deep-lane-output-v1" };
export type RadarDeepLaneInference = { key: string; label: string; statement: string; uncertainty: string; evidenceIds: readonly string[]; classification: "AI_INFERENCE"; origin: "INFERENCE" };
export type RadarDeepLaneResult = { schemaVersion: "deep-lane-output-v1"; provider: string; model: string; modelRevision: string | null; requestHash: string; generatedAt: string; inferences: readonly RadarDeepLaneInference[] };
export type RadarDeepLaneAdapter = { readonly provider: string; readonly model?: string; readonly modelRevision?: string; request(input: RadarDeepLaneRequest): Promise<unknown> };
export type RadarDeepLaneFailure = { kind: "TRANSIENT" | "PERMANENT"; code: RadarProviderErrorCode | "PROVIDER_FAILED"; summary: string; attempt: number };

export class RadarDeepLaneValidationError extends Error { constructor(message: string) { super(message); this.name = "RadarDeepLaneValidationError"; } }
const ID = /^[A-Za-z0-9][A-Za-z0-9._:-]{0,95}$/;
function safeText(value: unknown, label: string, max: number) { if (typeof value !== "string" || value.length === 0 || value.length > max || /[<>\u0000-\u001f]/.test(value)) throw new RadarDeepLaneValidationError(`${label} is not safe.`); return value; }
function object(value: unknown): Record<string, unknown> { if (!value || typeof value !== "object" || Array.isArray(value)) throw new RadarDeepLaneValidationError("Deep Lane output must be an object."); return value as Record<string, unknown>; }
function timestamp(value: unknown) { const result = safeText(value, "generatedAt", 64); if (!Number.isFinite(Date.parse(result))) throw new RadarDeepLaneValidationError("generatedAt must be an ISO timestamp."); return new Date(result).toISOString(); }
function manifestHash(input: Omit<RadarDeepLaneRequest, "inputHash">) { return sha256(input); }

export function prepareDeepLaneRequest(input: { tokenId: string; evidence: readonly RadarDeepLaneEvidenceInput[]; promptTemplateVersion: string; promptTemplateHash: string; frozenInputHash?: string }): RadarDeepLaneRequest {
  const tokenId = safeText(input.tokenId, "tokenId", 128); const promptTemplateVersion = safeText(input.promptTemplateVersion, "promptTemplateVersion", 64); const promptTemplateHash = safeText(input.promptTemplateHash, "promptTemplateHash", 128); const seen = new Set<string>();
  const evidence = [...input.evidence].sort((left, right) => left.evidenceId.localeCompare(right.evidenceId)).map((item) => { const evidenceId = safeText(item.evidenceId, "evidenceId", 128); if (!ID.test(evidenceId) || seen.has(evidenceId)) throw new RadarDeepLaneValidationError("Deep Lane evidence identifiers must be unique and bounded."); seen.add(evidenceId); if (!["VERIFIED_DATA", "STRONG_SIGNAL", "UNKNOWN"].includes(item.classification)) throw new RadarDeepLaneValidationError("Deep Lane evidence classification is invalid."); return { evidenceId, contentHash: safeText(item.contentHash, "contentHash", 128), classification: item.classification, statement: safeText(item.statement, "evidence statement", 2000) }; });
  if (evidence.length === 0) throw new RadarDeepLaneValidationError("Deep Lane requires a sealed evidence manifest.");
  const frozenInputHash = input.frozenInputHash ?? sha256(evidence.map((item) => item.contentHash).sort());
  const base = { schemaVersion: "deep-lane-request-v1" as const, tokenId, frozenInputHash, evidence, promptTemplateVersion, promptTemplateHash, outputSchemaVersion: "deep-lane-output-v1" as const };
  return Object.freeze({ ...base, inputHash: manifestHash(base) });
}

export function validateDeepLaneOutput(raw: unknown, request: RadarDeepLaneRequest, trustedIdentity?: { provider: string; model?: string; modelRevision?: string }): RadarDeepLaneResult {
  const { inputHash, ...base } = request;
  void inputHash;
  if (manifestHash(base) !== request.inputHash) throw new RadarDeepLaneValidationError("Deep Lane request manifest was changed after sealing.");
  const value = object(raw); if (value.schemaVersion !== request.outputSchemaVersion) throw new RadarDeepLaneValidationError("Unsupported Deep Lane output schema.");
  const provider = safeText(value.provider, "provider", 64); const model = safeText(value.model, "model", 128); const modelRevision = value.modelRevision === null || value.modelRevision === undefined ? null : safeText(value.modelRevision, "modelRevision", 128);
  if (trustedIdentity && (provider !== trustedIdentity.provider || (trustedIdentity.model !== undefined && model !== trustedIdentity.model) || (trustedIdentity.modelRevision !== undefined && modelRevision !== trustedIdentity.modelRevision))) throw new RadarDeepLaneValidationError("Deep Lane output identity does not match the trusted adapter.");
  const requestHash = safeText(value.requestHash, "requestHash", 128); if (requestHash !== request.inputHash) throw new RadarDeepLaneValidationError("Deep Lane output is not bound to the sealed input hash.");
  const generatedAt = timestamp(value.generatedAt); if (!Array.isArray(value.inferences) || value.inferences.length > 32) throw new RadarDeepLaneValidationError("Deep Lane inferences must be a bounded array.");
  const allowed = new Set(request.evidence.map((item) => item.evidenceId));
  const keys = new Set<string>();
  const inferences = value.inferences.map((item) => { const inference = object(item); const key = safeText(inference.key, "inference key", 96); if (keys.has(key)) throw new RadarDeepLaneValidationError("Deep Lane inference keys must be unique."); keys.add(key); const label = safeText(inference.label, "inference label", 160); const statement = safeText(inference.statement, "inference statement", 2000); const uncertainty = safeText(inference.uncertainty, "inference uncertainty", 500); if (!Array.isArray(inference.evidenceIds) || inference.evidenceIds.length === 0 || inference.evidenceIds.length > 16) throw new RadarDeepLaneValidationError("Every inference requires bounded evidence references."); const evidenceIds = inference.evidenceIds.map((id) => safeText(id, "inference evidence id", 128)); if (new Set(evidenceIds).size !== evidenceIds.length || evidenceIds.some((id) => !allowed.has(id))) throw new RadarDeepLaneValidationError("Deep Lane referenced evidence outside the sealed manifest."); return { key, label, statement, uncertainty, evidenceIds, classification: "AI_INFERENCE" as const, origin: "INFERENCE" as const }; });
  return { schemaVersion: request.outputSchemaVersion, provider, model, modelRevision, requestHash, generatedAt, inferences };
}

export function classifyDeepLaneFailure(input: { error: unknown; attempt: number; maxAttempts: number }): RadarDeepLaneFailure { const safe = sanitizeRadarProviderError(input.error); return { kind: safe.retryable && input.attempt < input.maxAttempts ? "TRANSIENT" : "PERMANENT", code: safe.retryable && input.attempt < input.maxAttempts ? safe.code : "PROVIDER_FAILED", summary: `${safe.code}: ${safe.summary}`, attempt: input.attempt }; }

export async function executeDeepLane(adapter: RadarDeepLaneAdapter, request: RadarDeepLaneRequest): Promise<RadarDeepLaneResult> { const raw = await adapter.request(request); return validateDeepLaneOutput(raw, request, { provider: adapter.provider, model: adapter.model, modelRevision: adapter.modelRevision }); }

export async function executeDeepLaneWork(input: { claimed: RadarClaimedDeepLaneWork; request: RadarDeepLaneRequest; adapter: RadarDeepLaneAdapter; gateway: RadarSystemGateway }): Promise<RadarDeepLaneResult> {
  const manifest = await input.gateway.getWorkManifest({ workItemId: input.claimed.workItemId, worker: input.claimed.worker, leaseToken: input.claimed.leaseToken, leaseGeneration: input.claimed.leaseGeneration });
  if (manifest.tokenId !== input.request.tokenId || manifest.sealedInputHash !== input.request.frozenInputHash) throw new RadarDeepLaneValidationError("Deep Lane request does not match the fenced sealed work manifest.");
  return executeDeepLane(input.adapter, input.request);
}

export type RadarClaimedDeepLaneWork = { workItemId: string; worker: string; leaseToken: string; leaseGeneration: number };
