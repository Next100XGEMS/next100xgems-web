import { describe, expect, it } from "vitest";
import { detectUnsupportedAnalyzerOutput, validateAnalyzerClaims } from "@/lib/token-analyzer/claims";
import { createEvidenceManifest } from "@/lib/token-analyzer/evidence";
import { resolveAnalyzerInput } from "@/lib/token-analyzer/input-resolver";

describe("Universal Token Analyzer evidence safety", () => {
  it("rejects claim references outside the manifest", () => {
    const input = { raw: "0x0000000000000000000000000000000000000001", hintChain: "ethereum" as const };
    const manifest = createEvidenceManifest(input, resolveAnalyzerInput(input), []);
    expect(validateAnalyzerClaims([{ claim: "x", source: "y", verification: "UNKNOWN", evidenceRefs: ["missing"], evidenceType: "UNKNOWN", field: "wallet", identity: null, value: "x" }], manifest)).toBe(false);
  });

  it("flags unsupported verified language when no verified evidence exists", () => {
    const input = { raw: "0x0000000000000000000000000000000000000001", hintChain: "ethereum" as const };
    const manifest = createEvidenceManifest(input, resolveAnalyzerInput(input), []);
    expect(detectUnsupportedAnalyzerOutput("verified wallet accumulation", manifest)).toContain("VERIFIED_WITHOUT_VERIFIED_DATA");
  });

  it("requires grounded supported claims and does not use missing-field labels as evidence", () => {
    const input = { raw: "0x0000000000000000000000000000000000000001", hintChain: "ethereum" as const };
    const manifest = createEvidenceManifest(input, resolveAnalyzerInput(input), []);
    expect(validateAnalyzerClaims([{ claim: "invented", source: "provider", verification: "SUPPORTED", evidenceRefs: [], evidenceType: "VERIFIED_DATA", field: "wallet", identity: null, value: "x" }], manifest)).toBe(false);
    expect(detectUnsupportedAnalyzerOutput({ provider: "invented", score: { value: 90 }, liquidity: "100" }, manifest)).toEqual(expect.arrayContaining(["PROVIDER_NOT_IN_EVIDENCE", "SCORE_NOT_FROM_DETERMINISTIC_ENGINE", "NUMERIC_OR_IDENTITY_FIELD_NOT_IN_EVIDENCE"]));
  });

  it("keeps stale observations stale and copies caller-owned evidence", () => {
    const input = { raw: "0x0000000000000000000000000000000000000001", hintChain: "ethereum" as const };
    const observation = { key: "price", label: "Price", value: "1", state: "STALE" as const, evidenceClass: "UNKNOWN" as const, source: "fixture", observedAt: new Date().toISOString(), evidenceId: "price-1", provenance: [] };
    const manifest = createEvidenceManifest(input, resolveAnalyzerInput(input), [observation]);
    expect(manifest.freshness.state).toBe("STALE");
    observation.value = "999";
    expect((manifest.observations[0] as { value: unknown }).value).toBe("1");
  });

  it("requires typed evidence, identity, and exact values for claims", () => {
    const input = { raw: "0x0000000000000000000000000000000000000001", hintChain: "ethereum" as const };
    const resolution = resolveAnalyzerInput(input);
    const observations = [{ key: "liquidity", label: "Liquidity", value: "100", state: "AVAILABLE" as const, evidenceClass: "VERIFIED_DATA" as const, source: "chain", observedAt: "2026-09-20T00:00:00.000Z", evidenceId: "liquidity-1", identity: "pool-1", provenance: [{ source: "chain", kind: "DIRECT_CHAIN" as const, reference: "pool-1", capturedAt: "2026-09-20T00:00:00.000Z" }] }];
    const manifest = createEvidenceManifest(input, resolution, observations);
    const valid = { claim: "Pool liquidity is 100", source: "chain", verification: "SUPPORTED" as const, evidenceRefs: ["liquidity-1"], evidenceType: "VERIFIED_DATA" as const, field: "liquidity", identity: "pool-1", value: "100" };
    expect(validateAnalyzerClaims([valid], manifest)).toBe(true);
    expect(validateAnalyzerClaims([{ ...valid, field: "wallet" }], manifest)).toBe(false);
    expect(validateAnalyzerClaims([{ ...valid, identity: "wrong-pool" }], manifest)).toBe(false);
    expect(validateAnalyzerClaims([{ ...valid, identity: "100" }], manifest)).toBe(false);
    expect(validateAnalyzerClaims([{ ...valid, identity: null }], manifest)).toBe(false);
    expect(validateAnalyzerClaims([{ ...valid, value: "999" }], manifest)).toBe(false);
    expect(validateAnalyzerClaims([{ ...valid, evidenceType: "AI_INFERENCE" }], manifest)).toBe(false);
    expect(validateAnalyzerClaims([{ ...valid, source: "invented" }], manifest)).toBe(false);
    expect(validateAnalyzerClaims([{ ...valid, verification: "SUPPORTED", field: "score", identity: "pool-1" }], manifest)).toBe(false);
    expect(validateAnalyzerClaims([{ ...valid, verification: "SUPPORTED", value: "100", evidenceType: "VERIFIED_DATA" }], { ...manifest, observations: [{ ...observations[0], state: "UNAVAILABLE" }] })).toBe(false);
  });

  it("flags a structured output value that disagrees with grounded evidence", () => {
    const input = { raw: "0x0000000000000000000000000000000000000001", hintChain: "ethereum" as const };
    const resolution = resolveAnalyzerInput(input);
    const observations = [{ key: "liquidity", label: "Liquidity", value: "100", state: "AVAILABLE" as const, evidenceClass: "VERIFIED_DATA" as const, source: "chain", observedAt: "2026-09-20T00:00:00.000Z", evidenceId: "liquidity-1", identity: "pool-1", provenance: [{ source: "chain", kind: "DIRECT_CHAIN" as const, reference: "pool-1", capturedAt: "2026-09-20T00:00:00.000Z" }] }];
    const manifest = createEvidenceManifest(input, resolution, observations);
    expect(detectUnsupportedAnalyzerOutput({ liquidity: "999" }, manifest)).toContain("EVIDENCE_VALUE_MISMATCH");
    expect(detectUnsupportedAnalyzerOutput({ liquidity: "100" }, manifest)).not.toContain("EVIDENCE_VALUE_MISMATCH");
  });

  it("requires a policy before an observation can be fresh", () => {
    const input = { raw: "0x0000000000000000000000000000000000000001", hintChain: "ethereum" as const };
    const resolution = resolveAnalyzerInput(input);
    const observation = { key: "price", label: "Price", value: "1", state: "AVAILABLE" as const, evidenceClass: "VERIFIED_DATA" as const, source: "chain", observedAt: "2026-09-20T00:00:00.000Z", evidenceId: "price-1", provenance: [] };
    expect(createEvidenceManifest(input, resolution, [observation]).freshness.state).toBe("UNKNOWN");
    expect(createEvidenceManifest(input, resolution, [observation], [], "2026-09-20T01:00:00.000Z", { maxAgeMs: 2 * 60 * 60 * 1000, referenceTime: "2026-09-20T01:00:00.000Z" }).freshness.state).toBe("FRESH");
    expect(createEvidenceManifest(input, resolution, [observation], [], "2026-09-20T04:00:00.000Z", { maxAgeMs: 2 * 60 * 60 * 1000, referenceTime: "2026-09-20T04:00:00.000Z" }).freshness.state).toBe("STALE");
    expect(createEvidenceManifest(input, resolution, [{ ...observation, observedAt: "2026-09-20T05:00:00.000Z" }], [], "2026-09-20T01:00:00.000Z", { maxAgeMs: 2 * 60 * 60 * 1000, referenceTime: "2026-09-20T01:00:00.000Z", maxFutureSkewMs: 60_000 }).freshness.state).toBe("UNKNOWN");
  });
});
