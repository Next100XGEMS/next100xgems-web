"use server";

import { revalidatePath } from "next/cache";
import { runAnalyzer, setAnalyzerEnabled, getAnalyzerProviderTelemetry, type AnalyzerOperationError } from "@/lib/token-analyzer/server";
import type { AnalyzerInput, AnalyzerResult } from "@/lib/token-analyzer/contracts";

export type AnalyzerActionResult = { ok: true; result?: AnalyzerResult; telemetry?: unknown[]; enabled?: boolean } | { ok: false; code: string; error: string };
function message(error: unknown) { const item = error as Partial<AnalyzerOperationError>; const code = typeof item.code === "string" ? item.code : "UNAVAILABLE"; const messages: Record<string, string> = { FEATURE_DISABLED: "Token Analyzer is disabled.", INVALID_INPUT: "The Analyzer input is invalid.", UNAUTHORIZED: "You are not authorized to operate the Token Analyzer.", CONFLICT: "The Analyzer request conflicts with an existing result.", PERSISTENCE_FAILURE: "Analyzer persistence is temporarily unavailable.", PROVIDER_FAILURE: "The requested evidence source is unavailable.", UNAVAILABLE: "Token Analyzer is temporarily unavailable." }; return { code, error: messages[code] ?? messages.UNAVAILABLE }; }
export async function analyzeToken(input: AnalyzerInput): Promise<AnalyzerActionResult> { try { const result = await runAnalyzer(input); const telemetry = result.deliveryId ? await getAnalyzerProviderTelemetry(result.deliveryId).catch(() => []) : []; revalidatePath("/admin/token-analyzer"); return { ok: true, result, telemetry }; } catch (error) { return { ok: false, ...message(error) }; } }
export async function updateAnalyzerEnabled(enabled: boolean): Promise<AnalyzerActionResult> { try { const value = await setAnalyzerEnabled(enabled); revalidatePath("/admin/token-analyzer"); revalidatePath("/admin/feature-flags"); return { ok: true, enabled: value }; } catch (error) { return { ok: false, ...message(error) }; } }
