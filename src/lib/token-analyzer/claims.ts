import type { AnalyzerClaim, AnalyzerEvidenceManifest } from "./contracts";
export function validateAnalyzerClaims(claims: readonly AnalyzerClaim[], manifest: AnalyzerEvidenceManifest) {
  const ids = new Set(manifest.observations.map((item) => item.evidenceId));
  const sources = new Set(manifest.observations.map((item) => item.source));
  return claims.every((claim) => claim.evidenceRefs.length > 0 && claim.evidenceRefs.every((ref) => ids.has(ref)) && (claim.verification !== "SUPPORTED" || sources.has(claim.source)));
}
export function detectUnsupportedAnalyzerOutput(value: unknown, manifest: AnalyzerEvidenceManifest) {
  const text = typeof value === "string" ? value : JSON.stringify(value ?? "");
  const availableKeys = new Set(manifest.observations.filter((item) => item.state === "AVAILABLE").map((item) => item.key));
  const sources = new Set(manifest.observations.map((item) => item.source));
  const flags: string[] = [];
  if (/verified|confirmed/i.test(text) && manifest.observations.every((item) => item.evidenceClass !== "VERIFIED_DATA")) flags.push("VERIFIED_WITHOUT_VERIFIED_DATA");
  if (/wallet|liquidity|volume/i.test(text) && !["wallet", "liquidity", "volume"].some((key) => availableKeys.has(key))) flags.push("NUMERIC_OR_IDENTITY_FIELD_NOT_IN_EVIDENCE");
  if (value && typeof value === "object" && !Array.isArray(value)) {
    const candidate = value as Record<string, unknown>; if (candidate.provider && (typeof candidate.provider !== "string" || !sources.has(candidate.provider))) flags.push("PROVIDER_NOT_IN_EVIDENCE");
    const score = candidate.score; if (score && typeof score === "object" && (score as Record<string, unknown>).value !== null && (score as Record<string, unknown>).value !== undefined) flags.push("SCORE_NOT_FROM_DETERMINISTIC_ENGINE");
  }
  return flags;
}
