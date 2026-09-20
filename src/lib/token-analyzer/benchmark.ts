import type { AnalyzerEvidenceManifest } from "./contracts";
export type AnalyzerBenchmarkCase = { id: string; manifest: AnalyzerEvidenceManifest; expectedUnknowns: string[] };
export type AnalyzerBenchmarkMeasurement = { caseId: string; schemaValid: boolean; evidenceReferencesValid: boolean; unknownHandling: boolean; hallucinationFlags: string[]; latencyMs: number | null; inputTokens: number | null; outputTokens: number | null; estimatedCost: string | null };
export function createAnalyzerBenchmarkCase(id: string, manifest: AnalyzerEvidenceManifest): AnalyzerBenchmarkCase { return { id, manifest, expectedUnknowns: [...manifest.missing] }; }
