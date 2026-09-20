import type { AnalyzerEvidenceManifest, AnalyzerScore } from "./contracts";

export const ANALYZER_METHODOLOGY_VERSION: string | null = null;
export const SCORE_COMPONENTS = ["marketStructure", "liquidityQuality", "distribution", "activity", "authorityRisk", "creatorRisk", "manipulationRisk", "dataQuality"] as const;
export function calculateAnalyzerScore(manifest: AnalyzerEvidenceManifest): AnalyzerScore {
  void manifest;
  return { value: null, max: 100, methodologyVersion: ANALYZER_METHODOLOGY_VERSION, status: "METHODOLOGY_NOT_ACTIVE", components: Object.fromEntries(SCORE_COMPONENTS.map((key) => [key, null])) };
}
