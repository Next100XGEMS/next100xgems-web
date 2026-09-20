"use server";

import { revalidatePath } from "next/cache";
import { runAnalyzer, setAnalyzerEnabled, type AnalyzerOperationError } from "@/lib/token-analyzer/server";
import type { AnalyzerInput, AnalyzerResult } from "@/lib/token-analyzer/contracts";

export type AnalyzerActionResult = { ok: true; result?: AnalyzerResult; enabled?: boolean } | { ok: false; code: string; error: string };
function message(error: unknown) { const item = error as Partial<AnalyzerOperationError>; return { code: typeof item.code === "string" ? item.code : "UNAVAILABLE", error: error instanceof Error ? error.message : "Token Analyzer is temporarily unavailable." }; }
export async function analyzeToken(input: AnalyzerInput): Promise<AnalyzerActionResult> { try { const result = await runAnalyzer(input); revalidatePath("/admin/token-analyzer"); return { ok: true, result }; } catch (error) { return { ok: false, ...message(error) }; } }
export async function updateAnalyzerEnabled(enabled: boolean): Promise<AnalyzerActionResult> { try { const value = await setAnalyzerEnabled(enabled); revalidatePath("/admin/token-analyzer"); revalidatePath("/admin/feature-flags"); return { ok: true, enabled: value }; } catch (error) { return { ok: false, ...message(error) }; } }
