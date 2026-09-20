import { describe, expect, it } from "vitest";
import { detectUnsupportedAnalyzerOutput, validateAnalyzerClaims } from "@/lib/token-analyzer/claims";
import { createEvidenceManifest } from "@/lib/token-analyzer/evidence";
import { resolveAnalyzerInput } from "@/lib/token-analyzer/input-resolver";

describe("Universal Token Analyzer evidence safety", () => {
  it("rejects claim references outside the manifest", () => {
    const input = { raw: "0x0000000000000000000000000000000000000001", hintChain: "ethereum" as const };
    const manifest = createEvidenceManifest(input, resolveAnalyzerInput(input), []);
    expect(validateAnalyzerClaims([{ claim: "x", source: "y", verification: "UNKNOWN", evidenceRefs: ["missing"] }], manifest)).toBe(false);
  });

  it("flags unsupported verified language when no verified evidence exists", () => {
    const input = { raw: "0x0000000000000000000000000000000000000001", hintChain: "ethereum" as const };
    const manifest = createEvidenceManifest(input, resolveAnalyzerInput(input), []);
    expect(detectUnsupportedAnalyzerOutput("verified wallet accumulation", manifest)).toContain("VERIFIED_WITHOUT_VERIFIED_DATA");
  });

  it("requires grounded supported claims and does not use missing-field labels as evidence", () => {
    const input = { raw: "0x0000000000000000000000000000000000000001", hintChain: "ethereum" as const };
    const manifest = createEvidenceManifest(input, resolveAnalyzerInput(input), []);
    expect(validateAnalyzerClaims([{ claim: "invented", source: "provider", verification: "SUPPORTED", evidenceRefs: [] }], manifest)).toBe(false);
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
});
