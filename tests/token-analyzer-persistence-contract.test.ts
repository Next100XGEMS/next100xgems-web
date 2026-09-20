import { readFileSync } from "node:fs";
import { describe, expect, it } from "vitest";
import policy from "@/lib/token-analyzer/persistence-policy.json";
import { assertContract, assertObservation } from "@/lib/token-analyzer/persistence-contract";
import { validateAnalyzerClaims } from "@/lib/token-analyzer/claims";
import positive from "./fixtures/token-analyzer-positive.json";
import type { AnalyzerEvidenceManifest } from "@/lib/token-analyzer/contracts";

function changed(path: string[], value: unknown, remove = false) {
  const copy = structuredClone(positive);
  let parent = copy as unknown as Record<string, unknown>;
  for (const key of path.slice(0, -1)) parent = parent[key] as Record<string, unknown>;
  if (remove) delete parent[path.at(-1)!]; else parent[path.at(-1)!] = value;
  return copy as unknown as AnalyzerEvidenceManifest;
}
describe("canonical persistence and typed evidence contract", () => {
  it("uses the same exact registry in TypeScript and PostgreSQL", () => {
    const migration = readFileSync("supabase/migrations/20260920000004_token_analyzer_receipt_integrity.sql", "utf8");
    expect(JSON.parse(migration.match(/\$policy\$([\s\S]*?)\$policy\$/)![1])).toEqual(policy);
  });
  it("accepts a fully grounded authoritative fact", () => {
    expect(() => assertContract(positive, "manifest")).not.toThrow();
    const manifest = positive as unknown as AnalyzerEvidenceManifest;
    expect(validateAnalyzerClaims(manifest.claims, manifest)).toBe(true);
  });
  it.each([null, "UNKNOWN", "UNAVAILABLE", "STALE", "PROVIDER_FAILURE"])("rejects positive support with observation state %s", (state) => {
    const manifest = changed(["observations", "0", "state"], state);
    expect(validateAnalyzerClaims(manifest.claims, manifest)).toBe(false);
  });
  it("rejects missing observation state", () => {
    const manifest = changed(["observations", "0", "state"], undefined, true);
    expect(validateAnalyzerClaims(manifest.claims, manifest)).toBe(false);
  });
  it.each(["manifestFormatVersion", "evidenceRevision"])("rejects numeric %s encoded as string", (field) => {
    expect(() => assertContract(changed([field], "1"), "manifest")).toThrow();
  });
  it.each(["versions", "methodologyVersion", "schemaVersion"])("requires %s, even if nullable", (field) => {
    expect(() => assertContract(changed([field], undefined, true), "manifest")).toThrow();
  });
  it.each([
    { whyMoving: [{ classification: null, evidenceRefs: ["missing"] }] },
    { whyMoving: [{ classification: "VERIFIED_FACT", field: "wallet", value: "999", evidenceRefs: ["liq1"] }] },
    { riskFactors: [{ key: "creator_exit", state: "PRESENT", evidenceRefs: ["liq1"] }] },
    { result: { score: { value: 99 } } },
  ])("rejects unregistered caller conclusions %j", (extra) => {
    expect(() => assertContract({ ...positive, ...extra }, "manifest")).toThrow();
  });
  it("does not treat evidence ID as semantic pool provenance", () => {
    const other = "0x0000000000000000000000000000000000000003";
    const manifest = structuredClone(positive) as unknown as AnalyzerEvidenceManifest;
    manifest.observations[0].evidenceId = other;
    manifest.observations[0].provenance[0].reference = other;
    manifest.claims[0].evidenceRefs = [other];
    expect(validateAnalyzerClaims(manifest.claims, manifest)).toBe(false);
  });
  it("does not promote contextual provenance to verified facts", () => {
    const manifest = changed(["observations", "0", "provenance", "0", "kind"], "CONTEXTUAL_PROPRIETARY");
    expect(validateAnalyzerClaims(manifest.claims, manifest)).toBe(false);
  });
  it("requires exact transaction provenance for typed trades, not a reused pool ID", () => {
    const manifest = structuredClone(positive) as unknown as AnalyzerEvidenceManifest;
    const observation = manifest.observations[0];
    observation.key = "trade";
    observation.identityType = "WALLET";
    expect(() => assertObservation(observation, manifest.resolvedToken)).toThrow();
    observation.transactionReference = "0x" + "a".repeat(64);
    observation.provenance[0].referenceType = "TRANSACTION";
    observation.provenance[0].reference = observation.transactionReference;
    expect(() => assertObservation(observation, manifest.resolvedToken)).not.toThrow();
    observation.provenance[0].reference = observation.evidenceId;
    expect(() => assertObservation(observation, manifest.resolvedToken)).toThrow();
  });
});
