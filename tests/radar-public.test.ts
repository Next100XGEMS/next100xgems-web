import { describe, expect, it } from "vitest";
import { mapPublicRadarRow } from "@/lib/radar/public-contract";

describe("published Radar public contract", () => {
  it("maps only the published projection and preserves exact score text", () => {
    const record = mapPublicRadarRow({ token_id: "token-1", chain: "eip155:1", contract_address: "0xabc", symbol: "GEM", name: "Example", analytical_status: "TRENDING", score: "99.000000000000000001", methodology_version: "approved-v1", analysis_version: 4, freshness_state: "FRESH", metrics: [{ metric_key: "liquidity", category: "market", value: "100.000000000000000001", state: "AVAILABLE", source: "fixture" }], evidence: [{ classification: "VERIFIED_DATA", category: "market", label: "Liquidity", value: "100.000000000000000001" }] });
    expect(record).toMatchObject({ score: "99.000000000000000001", methodologyVersion: "approved-v1", metrics: [{ value: "100.000000000000000001" }] });
  });

  it("rejects malformed rows instead of exposing an unsafe fallback", () => {
    expect(mapPublicRadarRow({ token_id: "token-1", analytical_status: "TRENDING", score: "1" })).toBeNull();
    expect(mapPublicRadarRow({ token_id: "token-1", chain: "eip155:1", contract_address: "0xabc", analytical_status: "REJECTED", analysis_version: 1, freshness_state: "FRESH" })).toBeNull();
  });
});
