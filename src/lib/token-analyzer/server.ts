import "server-only";

import { randomUUID } from "node:crypto";
import { getAuthorizationContext, type AuthorizationContext } from "@/lib/auth/authorization";
import policy from "./persistence-policy.json";
import { verifyEvidenceManifestHash } from "./evidence";
import type { AnalyzerInput, AnalyzerResolution, AnalyzerResult } from "./contracts";
import { collectLiveAnalyzerEvidence, prepareLiveAnalyzerResolution, type LivePreparedResolution } from "./live-intelligence";

export type AnalyzerRunOperation = "FRESH_ANALYSIS" | "EXPLICIT_REANALYSIS";
export type AnalyzerRunOptions = { operation?: AnalyzerRunOperation; reanalysisReason?: string; intentId?: string; sourceDeliveryId?: string };
export class AnalyzerOperationError extends Error { constructor(public readonly code: "FEATURE_DISABLED" | "INVALID_INPUT" | "UNAUTHORIZED" | "PROVIDER_FAILURE" | "PERSISTENCE_FAILURE" | "CONFLICT", message: string) { super(message); this.name = "AnalyzerOperationError"; } }
function requireOperator(context: AuthorizationContext) { if (!context.roles.some((role) => role === "owner" || role === "admin")) throw new AnalyzerOperationError("UNAUTHORIZED", "Only Owner or Admin can operate the Token Analyzer."); }
function stateFrom(data: unknown) { if (!data || typeof data !== "object" || Array.isArray(data)) throw new AnalyzerOperationError("PERSISTENCE_FAILURE", "Analyzer state is unavailable."); return data as Record<string, unknown>; }
async function readState(context: AuthorizationContext) { const { data, error } = await context.supabase.rpc("analyzer_read_state"); if (error) throw new AnalyzerOperationError("PERSISTENCE_FAILURE", "Analyzer state is unavailable."); return stateFrom(data); }
function safeBoolean(value: unknown) { return value === true; }
function safeResult(value: unknown): AnalyzerResult { if (!value || typeof value !== "object" || Array.isArray(value)) throw new AnalyzerOperationError("PERSISTENCE_FAILURE", "Analyzer result is unavailable."); return value as AnalyzerResult; }

export async function getAnalyzerSnapshot() {
  const context = await getAuthorizationContext(); requireOperator(context); const state = await readState(context);
  return { enabled: safeBoolean(state.enabled), publicEnabled: safeBoolean(state.public_enabled), aiEnabled: safeBoolean(state.ai_enabled), defaultModel: typeof state.default_model === "string" ? state.default_model : null, socialSpecialistEnabled: safeBoolean(state.social_specialist_enabled), escalationEnabled: safeBoolean(state.escalation_enabled), modelCostCap: typeof state.max_model_cost_per_analysis === "string" ? state.max_model_cost_per_analysis : null, dailyCostCap: typeof state.max_daily_model_spend === "string" ? state.max_daily_model_spend : null, monthlyCostCap: typeof state.max_monthly_model_spend === "string" ? state.max_monthly_model_spend : null, analysisCount: typeof state.analysis_count === "number" ? state.analysis_count : 0 };
}

export async function setAnalyzerEnabled(enabled: boolean) {
  const context = await getAuthorizationContext(); requireOperator(context); const { data, error } = await context.supabase.rpc("set_token_analyzer_enabled", { p_enabled: enabled });
  if (error || typeof data !== "boolean") throw new AnalyzerOperationError(error?.code === "42501" ? "UNAUTHORIZED" : "PERSISTENCE_FAILURE", "The Token Analyzer flag could not be changed."); return data;
}


function receiptResult(response: Record<string, unknown>): AnalyzerResult {
  return { ...safeResult(response.result), deliveryId: String(response.delivery_key) };
}
async function recordProviderTelemetry(context: AuthorizationContext, response: Record<string, unknown>, prepared: LivePreparedResolution, usage: readonly { provider: string; capability: string; status: string; latencyMs: number; attempts: number; cache: string; error: string | null }[]) {
  const requestId = typeof response.request_id === "string" ? response.request_id : null;
  const analysisId = typeof response.analysis_id === "string" ? response.analysis_id : null;
  if (!requestId || !analysisId) return;
  const observed = new Set(usage.map((item) => item.provider + ":" + item.capability));
  const statusOnly = prepared.statuses.filter((item) => !observed.has(item.provider + ":" + item.capability)).map((item) => ({ provider: item.provider, capability: item.capability, status: "CAPABILITY_STATUS", capabilityStatus: item.status, latencyMs: 0, attempts: 0, cache: "NONE", error: item.status === "TEMPORARILY_UNAVAILABLE" ? "TEMPORARILY_UNAVAILABLE" : null }));
  await Promise.all([...usage, ...statusOnly].map(async (item) => {
    const status = item.status === "CAPABILITY_STATUS" ? "SUCCEEDED" : item.status === "SUCCESS" || item.status === "CACHE_HIT" ? "SUCCEEDED" : item.status === "UNSUPPORTED" ? "UNSUPPORTED" : item.status === "NOT_CONFIGURED" ? "MISSING" : item.status === "RATE_LIMITED" ? "FAILED" : "FAILED";
    const capabilityStatus = "capabilityStatus" in item && typeof item.capabilityStatus === "string" ? item.capabilityStatus : null;
    try { await context.supabase.rpc("analyzer_record_provider_event", { p_payload: { request_id: requestId, analysis_id: analysisId, provider: item.provider, capability: item.capability, status, latency_ms: item.latencyMs, metadata: { attempts: item.attempts, cache: item.cache, error: item.error, requestMade: item.status !== "CAPABILITY_STATUS", capabilityStatus, statuses: prepared.statuses.filter((candidate) => candidate.provider === item.provider && candidate.capability === item.capability) } } }); } catch { /* telemetry must not invalidate a sealed analysis */ }
  }));
}
function rpcFailure(code?: string): never {
  if (code === "42501") throw new AnalyzerOperationError("UNAUTHORIZED", "Analyzer operation is not authorized.");
  if (code === "55000") throw new AnalyzerOperationError("FEATURE_DISABLED", "Analyzer mutation is disabled or the delivery is already sealed.");
  throw new AnalyzerOperationError("CONFLICT", "Analyzer delivery contract could not be satisfied.");
}
async function receipt(context: AuthorizationContext, key: string) {
  if (!/^[0-9a-f]{64}$/.test(key)) throw new AnalyzerOperationError("INVALID_INPUT", "Invalid delivery key.");
  const { data, error } = await context.supabase.rpc("analyzer_get_delivery_receipt", { p_delivery_key: key });
  if (error) rpcFailure(error.code);
  return stateFrom(data);
}
/** Historical retry accepts only the sealed key. No new input or evidence. */
export async function getAnalyzerDeliveryReceipt(key: string): Promise<AnalyzerResult> {
  const context = await getAuthorizationContext(); requireOperator(context);
  const response = await receipt(context, key);
  if (response.status !== "COMPLETED") throw new AnalyzerOperationError("PERSISTENCE_FAILURE", "Delivery is still in progress.");
  return receiptResult(response);
}

export async function runAnalyzer(input: AnalyzerInput, options: AnalyzerRunOptions = {}): Promise<AnalyzerResult> {
  const context = await getAuthorizationContext(); requireOperator(context);
  const state = await readState(context);
  if (!safeBoolean(state.enabled)) throw new AnalyzerOperationError("FEATURE_DISABLED", "Token Analyzer is disabled.");
  if (!input || typeof input.raw !== "string" || !input.raw.trim() || input.raw.length > 4096) throw new AnalyzerOperationError("INVALID_INPUT", "Enter a supported contract, mint, or URL.");
  const safeInput = { raw: input.raw.trim(), hintChain: input.hintChain ?? null };
  const prepared = await prepareLiveAnalyzerResolution({ raw: safeInput.raw, hintChain: input.hintChain ?? undefined });
  const resolution = prepared.resolution;
  let name = "analyzer_reserve_delivery";
  let parameters: Record<string, unknown> = { p_input: safeInput, p_resolution: resolution };
  if (options.operation === "FRESH_ANALYSIS") {
    name = "analyzer_start_fresh_analysis";
    parameters = { ...parameters, p_intent_id: options.intentId ?? randomUUID() };
  } else if (options.operation === "EXPLICIT_REANALYSIS") {
    if (!options.sourceDeliveryId || !options.reanalysisReason?.trim()) throw new AnalyzerOperationError("INVALID_INPUT", "Reanalysis requires a source delivery and reason.");
    name = "analyzer_start_reanalysis";
    parameters = { p_delivery_key: options.sourceDeliveryId, p_intent_id: options.intentId ?? randomUUID(), p_reason: options.reanalysisReason.trim() };
  } else if (options.operation !== undefined) throw new AnalyzerOperationError("INVALID_INPUT", "Unsupported Analyzer operation.");
  const reserved = await context.supabase.rpc(name, parameters);
  if (reserved.error) rpcFailure(reserved.error.code);
  const reservation = stateFrom(reserved.data);
  const key = String(reservation.delivery_key);
  if (reservation.status === "COMPLETED") return receiptResult(stateFrom(reservation.receipt));
  if (reservation.status === "EXISTING_IN_PROGRESS") {
    const deadline = Date.now() + policy.completionWaitMs;
    do {
      const response = await receipt(context, key);
      if (response.status === "COMPLETED") return receiptResult(response);
      await new Promise((resolve) => setTimeout(resolve, 100));
    } while (Date.now() < deadline);
    throw new AnalyzerOperationError("PERSISTENCE_FAILURE", "Delivery is still in progress; retry its receipt key.");
  }
  if (reservation.status !== "NEW" || typeof reservation.owner_token !== "string") throw new AnalyzerOperationError("PERSISTENCE_FAILURE", "Invalid reservation response.");
  let draft = null;
  let liveUsage = prepared.usage;
  if (!reservation.source_delivery_key) {
    // Only the reservation owner captures timestamped evidence.
    const live = await collectLiveAnalyzerEvidence(reservation.input as AnalyzerInput, { ...prepared, resolution: reservation.resolution as AnalyzerResolution });
    const manifest = live.manifest;
    liveUsage = live.usage;
    if (!verifyEvidenceManifestHash(manifest)) throw new AnalyzerOperationError("PERSISTENCE_FAILURE", "Evidence failed its local integrity check.");
    const { manifestHash: localHash, ...content } = manifest;
    void localHash;
    draft = content;
  }
  const completed = await context.supabase.rpc("analyzer_complete_delivery", { p_delivery_key: key, p_owner_token: reservation.owner_token, p_manifest: draft });
  if (completed.error) rpcFailure(completed.error.code);
  const response = stateFrom(completed.data);
  await recordProviderTelemetry(context, response, prepared, liveUsage);
  return receiptResult(await receipt(context, key));
}
