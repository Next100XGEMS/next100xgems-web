import { describe, expect, it } from "vitest";
import { assessEvmContractSemantics, assertSafeHistoricalLabels, classifyMarketConflict, collectPumpLifecycle, decodePumpBondingCurveAccount, deriveHolderConcentration, derivePumpBondingCurveAddress, HeliusSolanaAcceptanceClient } from "@/lib/radar/acceptance";

function accountBytes(values: readonly bigint[], complete = 0): Uint8Array {
  const bytes = new Uint8Array(49);
  for (let index = 0; index < values.length; index += 1) { let value = values[index] ?? BigInt(0); for (let offset = 0; offset < 8; offset += 1) { bytes[8 + index * 8 + offset] = Number(value % BigInt(256)); value /= BigInt(256); } }
  bytes[48] = complete;
  return bytes;
}

describe("Radar signal gap closure utilities", () => {
  it("decodes the official Pump bonding-curve layout with exact integers", () => {
    const decoded = decodePumpBondingCurveAccount({ data: accountBytes([BigInt(1_000_000), BigInt(2_000_000), BigInt(250_000), BigInt(400_000), BigInt(1_000_000)], 0), accountAddress: "curve" });
    expect(decoded.valid).toBe(true);
    expect(decoded.virtualSolReserves.value).toBe("2000000");
    expect(decoded.complete.value).toBe(false);
    expect(decoded.curveProgress).toMatchObject({ evidence: "OBJECTIVE_DERIVED", value: { numerator: "750000", denominator: "1000000" } });
    expect(decoded.creator).toMatchObject({ value: null, evidence: "UNKNOWN" });
  });

  it("rejects malformed Pump payloads without inventing lifecycle fields", () => {
    const decoded = decodePumpBondingCurveAccount({ data: new Uint8Array(48) });
    expect(decoded.valid).toBe(false);
    expect(decoded.tokenTotalSupply.value).toBeNull();
    expect(decoded.complete.evidence).toBe("UNKNOWN");
  });

  it("derives a deterministic bonding-curve PDA without a trading dependency", () => {
    const mint = "HPtntf37JUJyGtwoY6NBqhqo2TshsxVbNkg1iLSCpump";
    const first = derivePumpBondingCurveAddress(mint);
    expect(first).toBe(derivePumpBondingCurveAddress(mint));
    expect(first).toMatch(/^[1-9A-HJ-NP-Za-km-z]{32,44}$/);
  });

  it("keeps raw holder totals separate from exact derived concentration", () => {
    const result = deriveHolderConcentration([
      { address: "a", balance: "700" },
      { address: "b", balance: "200" },
      { address: "pool", balance: "100", excluded: true, exclusionReason: "known pool" },
    ], 2);
    expect(result.holderCount).toBe(2);
    expect(result.rawTotal).toBe("1000");
    expect(result.eligibleTotal).toBe("900");
    expect(result.concentration).toMatchObject({ numerator: "900", denominator: "900" });
    expect(result.excluded).toEqual([{ address: "pool", reason: "known pool" }]);
  });

  it("classifies provider conflicts without averaging values", () => {
    expect(classifyMarketConflict({ value: "250", poolId: "pool-a", quoteAsset: "SOL", scope: "SINGLE_POOL" }, { value: "1400000", poolId: "pool-b", quoteAsset: "SOL", scope: "AGGREGATED" })).toBe("AGGREGATED_VS_SINGLE_POOL");
    expect(classifyMarketConflict({ value: "250", poolId: "pool-a", quoteAsset: "SOL", scope: "SINGLE_POOL" }, { value: "248", poolId: "pool-a", quoteAsset: "SOL", scope: "SINGLE_POOL" })).toBe("SAME_POOL_DIFFERENT_VALUE");
    expect(classifyMarketConflict({ value: "250", quoteAsset: "SOL" }, { value: "248", quoteAsset: "USDC" })).toBe("QUOTE_ASSET_MISMATCH");
  });

  it("does not overclaim EVM owner or proxy semantics", () => {
    expect(assessEvmContractSemantics({ bytecodeAvailable: true, decimalsRead: true, supplyRead: true, ownerRead: false, proxyImplementationKnown: false })).toMatchObject({ standard: "STANDARD_ERC20", owner: "UNKNOWN", proxy: "UNKNOWN" });
    expect(assessEvmContractSemantics({ bytecodeAvailable: false, decimalsRead: false, supplyRead: false, ownerRead: false, proxyImplementationKnown: false }).standard).toBe("UNKNOWN");
  });

  it("accepts only structural historical labels", () => {
    expect(assertSafeHistoricalLabels(["SURVIVED_24H", "GRADUATED"])).toBe(true);
    expect(assertSafeHistoricalLabels(["WINNER", "BUY"])).toBe(false);
  });

  it("keeps the Solana client and Pump collector read-only", async () => {
    const client = new HeliusSolanaAcceptanceClient("fixture-key", async (_input, init) => {
      const body = JSON.parse(String(init?.body));
      if (body.method === "getAccountInfo") expect(body).toMatchObject({ method: "getAccountInfo" });
      return new Response(JSON.stringify({ result: { value: null } }), { status: 200 });
    });
    await expect(client.request("getAccountInfo", ["curve"])).resolves.toMatchObject({ result: { value: null } });
    await expect(client.request("sendTransaction", [])).rejects.toThrow(/read-only/);
    await expect(client.request("getTransactionsForAddress", ["curve", { transactionDetails: "signatures" }])).resolves.toBeDefined();
    const lifecycle = await collectPumpLifecycle({ mint: "HPtntf37JUJyGtwoY6NBqhqo2TshsxVbNkg1iLSCpump", request: client.request.bind(client) });
    expect(lifecycle.rpcCalls).toBe(1);
    expect(lifecycle.decode.valid).toBe(false);
    expect(lifecycle.decode.complete.evidence).toBe("UNKNOWN");
  });
});
