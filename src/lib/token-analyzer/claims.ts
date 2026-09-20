import type { AnalyzerClaim, AnalyzerEvidenceManifest } from "./contracts";
export function validateAnalyzerClaims(claims: readonly AnalyzerClaim[], manifest: AnalyzerEvidenceManifest) {
  const observations = new Map(manifest.observations.map((item) => [item.evidenceId, item]));
  return claims.every((claim) => {
    if (!claim.claim || !claim.source || !claim.field || !claim.evidenceType || !Array.isArray(claim.evidenceRefs) || claim.evidenceRefs.length === 0) return false;
    if (claim.verification === "SUPPORTED" || claim.verification === "PARTIALLY_SUPPORTED") {
      if (claim.identity === null) return false;
      if (claim.field === "score" || claim.field === "methodology" || claim.field === "riskScore") return false;
    }
    const referenced = claim.evidenceRefs.map((ref) => observations.get(ref));
    if (referenced.some((item) => !item)) return false;
    return referenced.every((item) => {
      if (item!.source !== claim.source || item!.key !== claim.field || item!.evidenceClass !== claim.evidenceType) return false;
      if (item!.state !== "AVAILABLE") return false;
      if (claim.identity !== item!.identity || item!.identity === null) return false;
      if (!item!.provenance.some((provenance) => provenance.source === claim.source)) return false;
      if (String(claim.value) !== String(item!.value)) return false;
      if (claim.verification === "SUPPORTED" && item!.evidenceClass !== "VERIFIED_DATA") return false;
      return true;
    });
  });
}
export function detectUnsupportedAnalyzerOutput(value: unknown, manifest: AnalyzerEvidenceManifest) {
  const text = typeof value === "string" ? value : JSON.stringify(value ?? "");
  const availableObservations = manifest.observations.filter((item) => item.state === "AVAILABLE");
  const availableKeys = new Set(availableObservations.map((item) => item.key));
  const sources = new Set(manifest.observations.map((item) => item.source));
  const flags: string[] = [];
  if (/verified|confirmed/i.test(text) && manifest.observations.every((item) => item.evidenceClass !== "VERIFIED_DATA")) flags.push("VERIFIED_WITHOUT_VERIFIED_DATA");
  if (/wallet|liquidity|volume/i.test(text) && !["wallet", "liquidity", "volume"].some((key) => availableKeys.has(key))) flags.push("NUMERIC_OR_IDENTITY_FIELD_NOT_IN_EVIDENCE");
  if (value && typeof value === "object" && !Array.isArray(value)) {
    const candidate = value as Record<string, unknown>;
    if (candidate.provider && (typeof candidate.provider !== "string" || !sources.has(candidate.provider))) flags.push("PROVIDER_NOT_IN_EVIDENCE");
    for (const field of ["price", "liquidity", "volume", "marketCap", "fdv", "wallet"]) {
      if (!(field in candidate)) continue;
      const observation = availableObservations.find((item) => item.key === field || (field === "wallet" && ["wallet", "creator", "deployer"].includes(item.key)));
      if (!observation) {
        if (!flags.includes("NUMERIC_OR_IDENTITY_FIELD_NOT_IN_EVIDENCE")) flags.push("NUMERIC_OR_IDENTITY_FIELD_NOT_IN_EVIDENCE");
        continue;
      }
      const candidateValue = candidate[field];
      const comparableValue = candidateValue && typeof candidateValue === "object" && "value" in candidateValue
        ? (candidateValue as Record<string, unknown>).value
        : candidateValue;
      if (String(comparableValue) !== String(observation.value)) flags.push("EVIDENCE_VALUE_MISMATCH");
    }
    const score = candidate.score; if (score && typeof score === "object" && (score as Record<string, unknown>).value !== null && (score as Record<string, unknown>).value !== undefined) flags.push("SCORE_NOT_FROM_DETERMINISTIC_ENGINE");
  }
  return flags;
}
