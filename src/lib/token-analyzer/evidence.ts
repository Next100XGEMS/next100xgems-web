import { sha256 } from "@/lib/radar/hash";
import { validateAnalyzerClaims } from "./claims";
import { ANALYZER_VERSIONS, assertContract, assertObservation } from "./persistence-contract";
import policy from "./persistence-policy.json";
import { type AnalyzerClaim, type AnalyzerEvidenceManifest, type AnalyzerInput, type AnalyzerObservation, type AnalyzerResolution } from "./contracts";

const missingFields = policy.requiredSignals;
const STATES = new Set(["AVAILABLE", "UNKNOWN", "UNAVAILABLE", "UNSUPPORTED", "STALE"]);
const CLASSES = new Set(["VERIFIED_DATA", "STRONG_SIGNAL", "AI_INFERENCE", "UNKNOWN"]);
function clone<T>(value: T): T { return JSON.parse(JSON.stringify(value)) as T; }
function freeze<T>(value: T): T { if (value && typeof value === "object") { Object.freeze(value); for (const child of Object.values(value as Record<string, unknown>)) freeze(child); } return value; }
function validTimestamp(value: string | null): boolean { return typeof value === "string" && Number.isFinite(Date.parse(value)); }
export type AnalyzerFreshnessPolicy = { maxAgeMs: number; maxFutureSkewMs?: number; referenceTime?: string };
function validateObservation(item: AnalyzerObservation) {
  if (!item || typeof item.key !== "string" || typeof item.label !== "string" || typeof item.source !== "string" || typeof item.evidenceId !== "string" || !STATES.has(item.state) || !CLASSES.has(item.evidenceClass)) throw new Error("Analyzer observation is invalid.");
  if (item.observedAt !== null && !validTimestamp(item.observedAt)) throw new Error("Analyzer observation timestamp is invalid.");
  if (!Array.isArray(item.provenance)) throw new Error("Analyzer observation provenance is invalid.");
}
function deriveFreshness(observations: AnalyzerObservation[], policy?: AnalyzerFreshnessPolicy) {
  if (observations.some((item) => item.state === "STALE")) return { state: "STALE" as const, reason: "At least one observation is explicitly stale." };
  if (observations.length === 0 || !policy || !Number.isFinite(policy.maxAgeMs) || policy.maxAgeMs < 0 || (policy.maxFutureSkewMs !== undefined && (!Number.isFinite(policy.maxFutureSkewMs) || policy.maxFutureSkewMs < 0))) return { state: "UNKNOWN" as const, reason: "No explicit freshness policy is available." };
  const reference = policy.referenceTime ?? new Date().toISOString();
  const referenceMs = Date.parse(reference);
  if (!Number.isFinite(referenceMs)) return { state: "UNKNOWN" as const, reason: "The freshness reference time is invalid." };
  if (observations.some((item) => item.state !== "AVAILABLE" || item.observedAt === null)) return { state: "UNKNOWN" as const, reason: "At least one observation is missing, unavailable, or not available as a fresh fact." };
  const futureSkew = policy.maxFutureSkewMs ?? 0;
  for (const item of observations) {
    const observedMs = Date.parse(item.observedAt!);
    if (!Number.isFinite(observedMs) || observedMs - referenceMs > futureSkew) return { state: "UNKNOWN" as const, reason: "An observation timestamp is invalid or outside the permitted future skew." };
    if (referenceMs - observedMs > policy.maxAgeMs) return { state: "STALE" as const, reason: "At least one observation is outside the configured freshness window." };
  }
  return { state: "FRESH" as const, reason: "All available observations are within the configured freshness window." };
}
export function createEvidenceManifest(input: AnalyzerInput, resolution: AnalyzerResolution, observations: AnalyzerObservation[] = [], claims: AnalyzerClaim[] = [], capturedAt = new Date().toISOString(), freshnessPolicy?: AnalyzerFreshnessPolicy, providerConflicts: AnalyzerEvidenceManifest["providerConflicts"] = []): AnalyzerEvidenceManifest {
  if (!validTimestamp(capturedAt)) throw new Error("Analyzer manifest timestamp is invalid.");
  observations.forEach(validateObservation);
  observations.forEach((item) => {
    try { assertObservation(item, resolution); } catch (error) { throw new Error(`Analyzer observation ${item.key} is invalid: ${error instanceof Error ? error.message : "validation failed"}`); }
  });
  const copiedObservations = clone(observations); const copiedClaims = clone(claims); const copiedResolution = clone(resolution);
  const available = new Set(copiedObservations.filter((item) => item.state === "AVAILABLE").map((item) => item.key));
  const freshness = deriveFreshness(copiedObservations, freshnessPolicy);
  const manifest = { schemaVersion: "token-analyzer-v1" as const, versions: ANALYZER_VERSIONS, manifestFormatVersion: 1 as const, evidenceRevision: 1, capturedAt, input: { type: copiedResolution.inputType, rawHash: sha256({ raw: input.raw.trim(), hintChain: input.hintChain ?? null }) }, resolvedToken: copiedResolution, observations: copiedObservations, claims: copiedClaims, providerConflicts: clone(providerConflicts), missing: missingFields.filter((item) => !available.has(item)), freshness, methodologyVersion: null as string | null };
  assertContract(manifest, "manifest");
  if (!validateAnalyzerClaims(copiedClaims, manifest as unknown as AnalyzerEvidenceManifest)) throw new Error("Analyzer claim grounding is invalid.");
  const result = { ...manifest, manifestHash: sha256(manifest) };
  return freeze(result);
}
export function verifyEvidenceManifestHash(manifest: AnalyzerEvidenceManifest) { const { manifestHash, ...content } = manifest; return sha256(content) === manifestHash; }
