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
});
