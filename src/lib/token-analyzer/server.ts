import "server-only";

import { createClient as createSupabaseClient, type SupabaseClient } from "@supabase/supabase-js";
import { getAuthorizationContext, type AuthorizationContext } from "@/lib/auth/authorization";
import { isFeatureEnabled } from "@/lib/feature-flags/server";
import { analyzeEvidence, stableAnalyzerRequestFingerprint } from "./analysis";
import { createEvidenceManifest } from "./evidence";
import { resolveAnalyzerInput } from "./input-resolver";
import type { AnalyzerInput, AnalyzerResult } from "./contracts";

export class AnalyzerOperationError extends Error {
  constructor(public readonly code: "FEATURE_DISABLED" | "INVALID_INPUT" | "UNAUTHORIZED" | "PROVIDER_FAILURE" | "PERSISTENCE_FAILURE", message: string) { super(message); this.name = "AnalyzerOperationError"; }
}

type AnalyzerSnapshot = { enabled: boolean; publicEnabled: boolean; aiEnabled: boolean; defaultModel: string | null; socialSpecialistEnabled: boolean; escalationEnabled: boolean; modelCostCap: string | null; dailyCostCap: string | null; monthlyCostCap: string | null; analysisCount: number };
let adminClient: SupabaseClient | null | undefined;
function getAdminClient() {
  if (adminClient !== undefined) return adminClient;
  const url = process.env.SUPABASE_URL; const key = process.env.SUPABASE_SECRET_KEY;
  if (!url || !key) { adminClient = null; return adminClient; }
  adminClient = createSupabaseClient(url, key, { auth: { autoRefreshToken: false, detectSessionInUrl: false, persistSession: false } });
  return adminClient;
}
function requireOperator(context: AuthorizationContext) { if (!context.roles.some((role) => role === "owner" || role === "admin")) throw new AnalyzerOperationError("UNAUTHORIZED", "Only Owner or Admin can operate the Token Analyzer."); }

export async function getAnalyzerSnapshot(): Promise<AnalyzerSnapshot> {
  const context = await getAuthorizationContext(); requireOperator(context);
  const enabled = await isFeatureEnabled("token_analyzer_enabled");
  const publicEnabled = await isFeatureEnabled("token_analyzer_public_enabled");
  const client = getAdminClient();
  if (!client) throw new AnalyzerOperationError("PERSISTENCE_FAILURE", "Analyzer administration is temporarily unavailable.");
  const [{ data: config }, { count }] = await Promise.all([
    client.from("analyzer_config").select("ai_enabled,default_model,social_specialist_enabled,escalation_enabled,max_model_cost_per_analysis,max_daily_model_spend,max_monthly_model_spend").eq("singleton", true).maybeSingle(),
    client.from("analyzer_analyses").select("id", { count: "exact", head: true }),
  ]);
  const row = config as Record<string, unknown> | null;
  return { enabled, publicEnabled, aiEnabled: row?.ai_enabled === true, defaultModel: typeof row?.default_model === "string" ? row.default_model : null, socialSpecialistEnabled: row?.social_specialist_enabled === true, escalationEnabled: row?.escalation_enabled === true, modelCostCap: typeof row?.max_model_cost_per_analysis === "string" ? row.max_model_cost_per_analysis : null, dailyCostCap: typeof row?.max_daily_model_spend === "string" ? row.max_daily_model_spend : null, monthlyCostCap: typeof row?.max_monthly_model_spend === "string" ? row.max_monthly_model_spend : null, analysisCount: typeof count === "number" ? count : 0 };
}

export async function setAnalyzerEnabled(enabled: boolean) {
  const context = await getAuthorizationContext(); requireOperator(context);
  const { data, error } = await context.supabase.rpc("set_token_analyzer_enabled", { p_enabled: enabled });
  if (error || typeof data !== "boolean") throw new AnalyzerOperationError(error?.code === "42501" ? "UNAUTHORIZED" : "PERSISTENCE_FAILURE", "The Token Analyzer flag could not be changed.");
  return data;
}

export async function runAnalyzer(input: AnalyzerInput): Promise<AnalyzerResult> {
  const context = await getAuthorizationContext(); requireOperator(context);
  if (!(await isFeatureEnabled("token_analyzer_enabled"))) throw new AnalyzerOperationError("FEATURE_DISABLED", "Token Analyzer is disabled. Enable it from its Admin control before running a new analysis.");
  if (!input || typeof input.raw !== "string" || input.raw.trim().length === 0 || input.raw.length > 4096) throw new AnalyzerOperationError("INVALID_INPUT", "Enter a supported contract, mint, or URL.");
  const client = getAdminClient(); if (!client) throw new AnalyzerOperationError("PERSISTENCE_FAILURE", "Analyzer persistence is temporarily unavailable.");
  const safeInput = { raw: input.raw.trim(), hintChain: input.hintChain ?? undefined };
  const fingerprint = stableAnalyzerRequestFingerprint(safeInput);
  const { data: existing } = await client.from("analyzer_requests").select("id").eq("request_fingerprint", fingerprint).eq("status", "ANALYZED").order("created_at", { ascending: false }).limit(1).maybeSingle();
  if (existing && typeof (existing as { id?: unknown }).id === "string") {
    const { data: previous } = await client.from("analyzer_analyses").select("result").eq("request_id", (existing as { id: string }).id).order("analysis_version", { ascending: false }).limit(1).maybeSingle();
    if (previous && typeof (previous as { result?: unknown }).result === "object") return (previous as { result: AnalyzerResult }).result;
  }
  const resolution = resolveAnalyzerInput(safeInput);
  const inputType = resolution.inputType;
  const requestInsert = await client.from("analyzer_requests").insert({ requester_id: context.userId, raw_input: safeInput.raw, input_type: inputType, requested_chain: safeInput.hintChain ?? null, request_fingerprint: fingerprint, status: "RECEIVED" }).select("id").single();
  if (requestInsert.error || !requestInsert.data || typeof (requestInsert.data as { id?: unknown }).id !== "string") throw new AnalyzerOperationError("PERSISTENCE_FAILURE", "Analyzer request could not be recorded.");
  const requestId = (requestInsert.data as { id: string }).id;
  const manifest = createEvidenceManifest(safeInput, resolution);
  const result = analyzeEvidence(requestId, safeInput, manifest);
  const resolutionWrite = await client.from("analyzer_resolutions").insert({ request_id: requestId, resolution });
  const manifestWrite = await client.from("analyzer_evidence_manifests").insert({ request_id: requestId, manifest_version: 1, manifest_hash: manifest.manifestHash, manifest }).select("id").single();
  const manifestId = manifestWrite.data && typeof (manifestWrite.data as { id?: unknown }).id === "string" ? (manifestWrite.data as { id: string }).id : null;
  if (resolutionWrite.error || manifestWrite.error || !manifestId) throw new AnalyzerOperationError("PERSISTENCE_FAILURE", "Analyzer evidence could not be persisted.");
  const analysisWrite = await client.from("analyzer_analyses").insert({ request_id: requestId, evidence_manifest_id: manifestId, analysis_version: 1, status: result.status, result, methodology_version: null });
  if (analysisWrite.error) throw new AnalyzerOperationError("PERSISTENCE_FAILURE", "Analyzer result could not be persisted.");
  await client.from("analyzer_requests").update({ status: "ANALYZED" }).eq("id", requestId);
  return result;
}
