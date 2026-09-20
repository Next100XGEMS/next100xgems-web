import { sha256 } from "@/lib/radar/hash";
import { type AnalyzerClaim, type AnalyzerEvidenceManifest, type AnalyzerInput, type AnalyzerObservation, type AnalyzerResolution } from "./contracts";

const missingFields = ["price", "marketCap", "fdv", "liquidity", "volume", "transactions", "holders", "distribution", "creatorBehavior", "authorities", "topTrades", "freshness"];
const STATES = new Set(["AVAILABLE", "UNKNOWN", "UNAVAILABLE", "UNSUPPORTED", "STALE"]);
const CLASSES = new Set(["VERIFIED_DATA", "STRONG_SIGNAL", "AI_INFERENCE", "UNKNOWN"]);
function clone<T>(value: T): T { return JSON.parse(JSON.stringify(value)) as T; }
function freeze<T>(value: T): T { if (value && typeof value === "object") { Object.freeze(value); for (const child of Object.values(value as Record<string, unknown>)) freeze(child); } return value; }
function validTimestamp(value: string | null): boolean { return typeof value === "string" && Number.isFinite(Date.parse(value)); }
function validateObservation(item: AnalyzerObservation) {
  if (!item || typeof item.key !== "string" || typeof item.label !== "string" || typeof item.source !== "string" || typeof item.evidenceId !== "string" || !STATES.has(item.state) || !CLASSES.has(item.evidenceClass)) throw new Error("Analyzer observation is invalid.");
  if (item.observedAt !== null && !validTimestamp(item.observedAt)) throw new Error("Analyzer observation timestamp is invalid.");
  if (!Array.isArray(item.provenance)) throw new Error("Analyzer observation provenance is invalid.");
}
export function createEvidenceManifest(input: AnalyzerInput, resolution: AnalyzerResolution, observations: AnalyzerObservation[] = [], claims: AnalyzerClaim[] = [], capturedAt = new Date().toISOString()): AnalyzerEvidenceManifest {
  if (!validTimestamp(capturedAt)) throw new Error("Analyzer manifest timestamp is invalid.");
  observations.forEach(validateObservation);
  const copiedObservations = clone(observations); const copiedClaims = clone(claims); const copiedResolution = clone(resolution);
  const available = new Set(copiedObservations.filter((item) => item.state === "AVAILABLE").map((item) => item.key));
  const freshnessState = copiedObservations.length === 0 ? "UNKNOWN" : copiedObservations.some((item) => item.state === "STALE") ? "STALE" : copiedObservations.some((item) => item.observedAt === null) ? "UNKNOWN" : "FRESH";
  const reason = freshnessState === "STALE" ? "At least one observation is explicitly stale." : freshnessState === "UNKNOWN" ? "No complete timestamped observation set is available." : "All observations are timestamped and non-stale.";
  const manifest = { schemaVersion: "token-analyzer-v1" as const, manifestVersion: 1, capturedAt, input: { type: copiedResolution.inputType, rawHash: sha256({ raw: input.raw.trim(), hintChain: input.hintChain ?? null }) }, resolvedToken: copiedResolution, observations: copiedObservations, claims: copiedClaims, providerConflicts: [], missing: missingFields.filter((item) => !available.has(item)), freshness: { state: freshnessState as "FRESH" | "STALE" | "UNKNOWN", reason }, methodologyVersion: null as string | null };
  const result = { ...manifest, manifestHash: sha256(manifest) };
  return freeze(result);
}
export function verifyEvidenceManifestHash(manifest: AnalyzerEvidenceManifest) { const { manifestHash, ...content } = manifest; return sha256(content) === manifestHash; }
