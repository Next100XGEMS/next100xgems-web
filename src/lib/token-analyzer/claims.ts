import type { AnalyzerClaim, AnalyzerEvidenceManifest } from "./contracts";
export function validateAnalyzerClaims(claims: readonly AnalyzerClaim[], manifest: AnalyzerEvidenceManifest) {
  const ids = new Set(manifest.observations.map((item) => item.evidenceId));
  return claims.every((claim) => claim.evidenceRefs.every((ref) => ids.has(ref)));
}
export function detectUnsupportedAnalyzerOutput(value: unknown, manifest: AnalyzerEvidenceManifest) {
  const text = typeof value === "string" ? value : JSON.stringify(value ?? "");
  const evidenceText = JSON.stringify(manifest);
  const flags: string[] = [];
  if (/verified|confirmed/i.test(text) && manifest.observations.every((item) => item.evidenceClass !== "VERIFIED_DATA")) flags.push("VERIFIED_WITHOUT_VERIFIED_DATA");
  if (/wallet|liquidity|volume/i.test(text) && !/wallet|liquidity|volume/i.test(evidenceText)) flags.push("NUMERIC_OR_IDENTITY_FIELD_NOT_IN_EVIDENCE");
  return flags;
}
