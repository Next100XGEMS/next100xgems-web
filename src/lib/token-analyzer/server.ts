import "server-only";

import { getAuthorizationContext, type AuthorizationContext } from "@/lib/auth/authorization";
import { analyzeEvidence, stableAnalyzerRequestFingerprint } from "./analysis";
import { createEvidenceManifest, verifyEvidenceManifestHash } from "./evidence";
import { resolveAnalyzerInput } from "./input-resolver";
import type { AnalyzerInput, AnalyzerResult } from "./contracts";

const REPLAY_FRESHNESS_MS = 5 * 60 * 1000;
export type AnalyzerRunOperation = "DELIVERY_RETRY" | "FRESH_ANALYSIS" | "EXPLICIT_REANALYSIS";
export type AnalyzerRunOptions = { operation?: AnalyzerRunOperation; reanalysisReason?: string };
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

export async function runAnalyzer(input: AnalyzerInput, options: AnalyzerRunOptions = {}): Promise<AnalyzerResult> {
  const context = await getAuthorizationContext(); requireOperator(context); const state = await readState(context);
  if (!safeBoolean(state.enabled)) throw new AnalyzerOperationError("FEATURE_DISABLED", "Token Analyzer is disabled. Enable it from its Admin control before running a new analysis.");
  if (!input || typeof input.raw !== "string" || input.raw.trim().length === 0 || input.raw.length > 4096) throw new AnalyzerOperationError("INVALID_INPUT", "Enter a supported contract, mint, or URL.");
  const operation = options.operation ?? "DELIVERY_RETRY"; if (operation === "EXPLICIT_REANALYSIS" && !options.reanalysisReason?.trim()) throw new AnalyzerOperationError("INVALID_INPUT", "An explicit reanalysis requires a reason.");
  const safeInput: AnalyzerInput = { raw: input.raw.trim(), hintChain: input.hintChain }; const resolution = resolveAnalyzerInput(safeInput); const manifest = createEvidenceManifest(safeInput, resolution); if (!verifyEvidenceManifestHash(manifest)) throw new AnalyzerOperationError("PERSISTENCE_FAILURE", "Analyzer evidence could not be verified locally.");
  const fingerprint = stableAnalyzerRequestFingerprint(safeInput, resolution); const result = analyzeEvidence("00000000-0000-4000-8000-000000000000", safeInput, manifest); const identity = { chain: resolution.chain, canonicalTokenId: resolution.canonicalTokenId, inputType: resolution.inputType, pairAddress: resolution.pairAddress, poolAddress: resolution.poolAddress, schemaVersion: manifest.schemaVersion, methodologyVersion: manifest.methodologyVersion, scoreEngineVersion: null, analysisMode: "DETERMINISTIC" };
  const expires = manifest.freshness.state === "FRESH" ? new Date(Date.now() + REPLAY_FRESHNESS_MS).toISOString() : new Date().toISOString();
  const { data, error } = await context.supabase.rpc("analyzer_submit_run", { p_payload: { fingerprint, raw_input: safeInput.raw, input_type: resolution.inputType, requested_chain: resolution.chain, resolution, manifest, result, status: result.status, schema_version: manifest.schemaVersion, score_engine_version: null, analysis_mode: "DETERMINISTIC", freshness_class: manifest.freshness.state, freshness_expires_at: expires, methodology_version: null, identity, operation, reanalysis_reason: options.reanalysisReason?.trim() ?? null } });
  if (error) { if (error.code === "42501") throw new AnalyzerOperationError("UNAUTHORIZED", "Analyzer operation is not authorized."); if (error.code === "55000") throw new AnalyzerOperationError("FEATURE_DISABLED", "Token Analyzer is disabled."); if (error.code === "23P01") throw new AnalyzerOperationError("CONFLICT", "Analyzer request context conflicts with an existing result."); throw new AnalyzerOperationError("PERSISTENCE_FAILURE", "Analyzer result could not be persisted."); }
  const response = stateFrom(data); return safeResult(response.result);
}
