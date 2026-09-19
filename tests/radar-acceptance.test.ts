import { describe, expect, it } from "vitest";
import { AlchemyReadOnlyAcceptanceClient, compareAcceptanceRecords, createAcceptanceDataset, createAcceptanceSample, createChainAcceptancePlan, collectAcceptanceProbe, FixtureAcceptanceProvider, AcceptanceTelemetryStore, summarizeChainActivity } from "@/lib/radar/acceptance";

const observedAt = "2026-09-20T00:00:00.000Z";
const sample = createAcceptanceSample({ sampleId: "solana-test-1", chain: "solana", tier: "A_DEEP", category: "ACTIVE_LAUNCH", tokenAddress: "fixture-token" });

describe("Radar provider acceptance sandbox", () => {
  it("creates a credential-free dataset template with bounded sample identities", () => {
    const dataset = createAcceptanceDataset([sample]);
    expect(dataset.schemaVersion).toBe("radar-acceptance-dataset-v1");
    expect(dataset.samples[0]).toMatchObject({ chain: "solana", tokenAddress: "fixture-token", approvedForLiveProbe: false });
  });

  it("builds chain-specific plans without forcing Solana fields onto EVM chains", () => {
    expect(createChainAcceptancePlan("solana").chainSpecificCapabilities).toContain("TOKEN_AUTHORITIES");
    expect(createChainAcceptancePlan("ethereum").chainSpecificCapabilities).toContain("CONTRACT_STATE");
    expect(createChainAcceptancePlan("ethereum").chainSpecificCapabilities).not.toContain("LAUNCHPAD_LIFECYCLE");
  });

  it("normalizes fixture provider data through the existing Radar contract", async () => {
    const provider = new FixtureAcceptanceProvider("birdeye", [{ chain: "solana", capability: "PRICE", metricKey: "usd", state: "AVAILABLE", value: "0.000000000123400", responseBytes: 128, requestUnits: "1" }]);
    const telemetry = new AcceptanceTelemetryStore();
    const record = await collectAcceptanceProbe({ sample, provider, capability: "PRICE", metricKey: "usd", observedAt, telemetry });
    expect(record.normalized?.value).toBe("0.0000000001234");
    expect(telemetry.summaries()[0]).toMatchObject({ successRate: "1.0000", records: 1 });
    expect(telemetry.usageProjection("birdeye").callsPerDay[100]).toBe("100.00");
  });

  it("preserves unsupported and unknown states instead of inventing values", async () => {
    const provider = new FixtureAcceptanceProvider("evm-rpc");
    const telemetry = new AcceptanceTelemetryStore();
    const unsupported = await collectAcceptanceProbe({ sample: { ...sample, chain: "solana" }, provider, capability: "CONTRACT_STATE", metricKey: "proxy", observedAt, telemetry });
    const unknown = await collectAcceptanceProbe({ sample, provider: new FixtureAcceptanceProvider("birdeye"), capability: "PRICE", metricKey: "usd", observedAt, telemetry });
    expect(unsupported.normalized?.state).toBe("UNSUPPORTED");
    expect(unknown.normalized?.state).toBe("UNKNOWN");
    expect(unsupported.normalized?.value).toBeNull();
  });

  it("compares equivalent sources without averaging or favorable-value selection", async () => {
    const telemetry = new AcceptanceTelemetryStore();
    const left = await collectAcceptanceProbe({ sample, provider: new FixtureAcceptanceProvider("birdeye", [{ chain: "solana", capability: "LIQUIDITY", metricKey: "usd", state: "AVAILABLE", value: "250.00" }]), capability: "LIQUIDITY", metricKey: "usd", observedAt, telemetry });
    const right = await collectAcceptanceProbe({ sample, provider: new FixtureAcceptanceProvider("coingecko", [{ chain: "solana", capability: "LIQUIDITY", metricKey: "usd", state: "AVAILABLE", value: "248.00" }]), capability: "LIQUIDITY", metricKey: "usd", observedAt, telemetry });
    expect(compareAcceptanceRecords(left, right)).toMatchObject({ status: "DISAGREEMENT", leftValue: "250", rightValue: "248" });
  });

  it("summarizes development activity without producing a production ranking", async () => {
    const record = await collectAcceptanceProbe({ sample, provider: new FixtureAcceptanceProvider("birdeye", [{ chain: "solana", capability: "PRICE", metricKey: "usd", state: "STALE", reason: "fixture is old" }]), capability: "PRICE", metricKey: "usd", observedAt });
    expect(summarizeChainActivity("solana", [record])).toMatchObject({ staleRecords: 1, status: "DEFER" });
  });

  it("routes Alchemy acceptance reads by EVM chain and rejects execution methods", async () => {
    const client = new AlchemyReadOnlyAcceptanceClient("fixture-key", async (input, init) => {
      expect(input).toContain("base-mainnet");
      expect(JSON.parse(String(init?.body))).toMatchObject({ method: "eth_blockNumber" });
      return new Response(JSON.stringify({ jsonrpc: "2.0", id: 1, result: "0x1" }), { status: 200 });
    });
    await expect(client.request("base", "eth_blockNumber")).resolves.toMatchObject({ success: true, hasResult: true });
    await expect(client.request("sui", "eth_blockNumber")).resolves.toMatchObject({ errorCode: "UNSUPPORTED_CHAIN" });
    await expect(client.request("base", "eth_sendRawTransaction", [])).rejects.toThrow(/read-only/);
  });
});
