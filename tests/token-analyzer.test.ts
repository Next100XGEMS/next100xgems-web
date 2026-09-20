import { describe, expect, it } from "vitest";
import { analyzeEvidence, stableAnalyzerRequestFingerprint } from "@/lib/token-analyzer/analysis";
import { createEvidenceManifest } from "@/lib/token-analyzer/evidence";
import { classifyAnalyzerInput, resolveAnalyzerInput } from "@/lib/token-analyzer/input-resolver";
import { calculatePositionSizing } from "@/lib/token-analyzer/risk";
import { calculateAnalyzerScore } from "@/lib/token-analyzer/score-engine";
import { routeAnalyzerAi } from "@/lib/token-analyzer/ai";
import type { AnalyzerInput } from "@/lib/token-analyzer/contracts";

describe("Universal Token Analyzer contracts", () => {
  it("classifies and resolves direct EVM and Solana inputs without trusting names", () => {
    expect(classifyAnalyzerInput("0x0000000000000000000000000000000000000001")).toBe("CONTRACT_ADDRESS");
    const evm = resolveAnalyzerInput({ raw: "0x0000000000000000000000000000000000000001", hintChain: "base" });
    expect(evm.chain).toBe("base");
    expect(evm.canonicalTokenId).toBe("base:0x0000000000000000000000000000000000000001");
    const solana = resolveAnalyzerInput({ raw: "So11111111111111111111111111111111111111112", hintChain: "solana" });
    expect(solana.inputType).toBe("TOKEN_MINT");
    expect(solana.chain).toBe("solana");
  });

  it("extracts only structured identity from approved URL shapes", () => {
    const result = resolveAnalyzerInput({ raw: "https://dexscreener.com/base/0x0000000000000000000000000000000000000001" });
    expect(result.inputType).toBe("DEX_URL");
    expect(result.chain).toBe("base");
    expect(result.pairAddress).toBe("0x0000000000000000000000000000000000000001");
    expect(result.name).toBeNull();
    expect(result.tokenAddress).toBeNull();
  });

  it("preserves Solana case and does not trust a syntax-only identity as resolved", () => {
    const mint = "So11111111111111111111111111111111111111112";
    const result = resolveAnalyzerInput({ raw: mint, hintChain: "solana" });
    expect(result.tokenAddress).toBe(mint);
    expect(result.canonicalTokenId).toBe(`solana:${mint}`);
    expect(result.confidence).toBe("CANDIDATE_IDENTITY");
    expect(resolveAnalyzerInput({ raw: mint }).tokenAddress).toBe(mint);
  });

  it("accepts valid off-curve PDA encodings as Solana address candidates", () => {
    const pda = "6PiyjiAPkp2KdZtqkyQYzVsD1Prv7t8v4TaYd8ip4YFd";
    expect(resolveAnalyzerInput({ raw: pda }).tokenAddress).toBe(pda);
  });

  it("rejects spoofed provider hosts and conflicting chain context", () => {
    expect(resolveAnalyzerInput({ raw: "https://dexscreener.com.evil.test/base/0x0000000000000000000000000000000000000001" }).inputType).toBe("GENERIC_URL");
    expect(resolveAnalyzerInput({ raw: "https://dexscreener.com/base/0x0000000000000000000000000000000000000001?chain=ethereum" }).inputType).toBe("UNKNOWN");
  });

  it("rejects unsupported schemes and leaves identity unresolved", () => {
    const result = resolveAnalyzerInput({ raw: "file:///etc/passwd" });
    expect(result.inputType).toBe("UNKNOWN");
    expect(result.tokenAddress).toBeNull();
  });

  it("keeps an unrecognized public URL as generic context", () => {
    expect(classifyAnalyzerInput("https://example.com/mention")).toBe("GENERIC_URL");
  });

  it("creates immutable-hashable evidence with explicit missingness", () => {
    const input: AnalyzerInput = { raw: "0x0000000000000000000000000000000000000001", hintChain: "ethereum" };
    const resolution = resolveAnalyzerInput(input);
    const manifest = createEvidenceManifest(input, resolution);
    expect(manifest.schemaVersion).toBe("token-analyzer-v1");
    expect(manifest.manifestHash).toMatch(/^[0-9a-f]{64}$/);
    expect(manifest.missing).toContain("liquidity");
    expect(manifest.freshness.state).toBe("UNKNOWN");
  });

  it("returns no score until a validated methodology exists", () => {
    const input = { raw: "0x0000000000000000000000000000000000000001", hintChain: "ethereum" as const };
    const manifest = createEvidenceManifest(input, resolveAnalyzerInput(input));
    expect(calculateAnalyzerScore(manifest)).toMatchObject({ value: null, status: "METHODOLOGY_NOT_ACTIVE" });
    expect(analyzeEvidence("00000000-0000-4000-8000-000000000001", input, manifest).status).toBe("INSUFFICIENT_DATA");
  });

  it("deduplicates equivalent request inputs but changes meaningful input", () => {
    expect(stableAnalyzerRequestFingerprint({ raw: " A " })).toBe(stableAnalyzerRequestFingerprint({ raw: "A" }));
    expect(stableAnalyzerRequestFingerprint({ raw: "A" })).not.toBe(stableAnalyzerRequestFingerprint({ raw: "B" }));
  });

  it("keeps AI disabled and only selects explicitly enabled routes", () => {
    expect(routeAnalyzerAi({ enabled: false, hasSocialInput: true, needsEscalation: true, socialSpecialistEnabled: true, escalationEnabled: true }).role).toBe("DISABLED");
    expect(routeAnalyzerAi({ enabled: true, hasSocialInput: true, needsEscalation: false, socialSpecialistEnabled: true, escalationEnabled: false }).role).toBe("SOCIAL_SPECIALIST");
  });

  it("calculates position size only from explicit valid risk inputs", () => {
    expect(calculatePositionSizing({ portfolioCapital: "1000", maxRiskPercent: "1", entryPrice: "10", invalidationPrice: "9" })).toMatchObject({ status: "AVAILABLE", riskBudget: "10", positionNotional: "100" });
    expect(calculatePositionSizing({ portfolioCapital: "1000", maxRiskPercent: "1", entryPrice: "10", invalidationPrice: "10" }).status).toBe("INVALID_INPUT");
    expect(calculatePositionSizing({ portfolioCapital: "1000", maxRiskPercent: "1", entryPrice: "10", invalidationPrice: "9", maxPositionNotional: "50" }).positionNotional).toBe("50");
    expect(calculatePositionSizing({ portfolioCapital: "1000000000000000000000000000000", maxRiskPercent: "100", entryPrice: "10", invalidationPrice: "9" })).toMatchObject({ status: "AVAILABLE", riskBudget: "1000000000000000000000000000000", positionNotional: "10000000000000000000000000000000" });
    expect(calculatePositionSizing({ portfolioCapital: "1" + "0".repeat(38), maxRiskPercent: "100", entryPrice: "10", invalidationPrice: "9" }).status).toBe("INVALID_INPUT");
    expect(calculatePositionSizing({ portfolioCapital: "0.000000000001", maxRiskPercent: "50", entryPrice: "1", invalidationPrice: "0.9" })).toMatchObject({ status: "AVAILABLE", riskBudget: "0.0000000000005" });
    expect(calculatePositionSizing({ portfolioCapital: "0.000000000000000001", maxRiskPercent: "100", entryPrice: "1", invalidationPrice: "0.9" })).toMatchObject({ status: "AVAILABLE", riskBudget: "0.000000000000000001", positionNotional: "0.00000000000000001" });
    expect(calculatePositionSizing({ portfolioCapital: "10000", maxRiskPercent: "1", entryPrice: "1", invalidationPrice: "1.000000000000000001" })).toMatchObject({ status: "AVAILABLE", stopDistancePercent: "0.0000000000000001" });
  });
});
