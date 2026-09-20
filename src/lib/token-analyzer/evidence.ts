import { sha256 } from "@/lib/radar/hash";
import { type AnalyzerClaim, type AnalyzerEvidenceManifest, type AnalyzerInput, type AnalyzerObservation, type AnalyzerResolution } from "./contracts";

const missingFields = ["price", "marketCap", "fdv", "liquidity", "volume", "transactions", "holders", "distribution", "creatorBehavior", "authorities", "topTrades", "freshness"];
export function createEvidenceManifest(input: AnalyzerInput, resolution: AnalyzerResolution, observations: AnalyzerObservation[] = [], claims: AnalyzerClaim[] = [], capturedAt = new Date().toISOString()): AnalyzerEvidenceManifest {
  const available = new Set(observations.filter((item) => item.state === "AVAILABLE").map((item) => item.key));
  const manifest = { schemaVersion: "token-analyzer-v1" as const, manifestVersion: 1, capturedAt, input: { type: resolution.inputType, rawHash: sha256(input.raw) }, resolvedToken: resolution, observations, claims, providerConflicts: [], missing: missingFields.filter((item) => !available.has(item)), freshness: { state: observations.length ? "FRESH" as const : "UNKNOWN" as const, reason: observations.length ? "Observation timestamps were supplied by the manifest builder." : "No provider observations were available." }, methodologyVersion: null as string | null };
  return { ...manifest, manifestHash: sha256(manifest) };
}
