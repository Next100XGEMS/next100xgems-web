import { afterEach, describe, expect, it, vi } from "vitest";
import { collectLiveAnalyzerEvidence, prepareLiveAnalyzerResolution, jsonRequest, compareMarketObservations } from "@/lib/token-analyzer/live-intelligence";
import { TOKEN_PROGRAM, TOKEN_2022_PROGRAM, verifySolanaMint, totalSupplyShare } from "@/lib/token-analyzer/provider-integrity";
import { collectPumpLifecycle, derivePumpBondingCurveAddress, PUMP_PROGRAM_ID } from "@/lib/radar/acceptance/solana";
import { resolveAnalyzerInput } from "@/lib/token-analyzer/input-resolver";
import type { AnalyzerProviderUsage } from "@/lib/token-analyzer/contracts";
vi.mock("server-only", () => ({}));
const mint = "So11111111111111111111111111111111111111112";
const pool = "DYDXN8tmpQf2K64wpxKfndV8o7cgicGxsSM2WGWky3Rf";
const token = "0x0000000000000000000000000000000000000001";
const evmPool = "0x0000000000000000000000000000000000000002";
const quoteToken = "0x0000000000000000000000000000000000000003";
function mintBytes() { const bytes = Buffer.alloc(82); bytes[45] = 1; bytes[44] = 6; bytes.writeBigUInt64LE(BigInt(1000), 36); return bytes; }
function account(bytes = mintBytes(), owner: unknown = TOKEN_PROGRAM) { return { owner, executable: false, data: [bytes.toString("base64"), "base64"] }; }
function json(value: unknown, status = 200) { return new Response(JSON.stringify(value), { status }); }
afterEach(() => { vi.unstubAllGlobals(); vi.unstubAllEnvs(); });

describe("provider identity boundary", () => {
  it.each(["https://attacker.invalid/token/" + mint, "https://fake.birdeye.so/token/" + mint + "?chain=solana", "https://birdeye.so/wrong/" + mint + "?chain=solana"])("never retrieves an unapproved provider URL %s", async (raw) => {
    const fetch = vi.fn(); vi.stubGlobal("fetch", fetch);
    await expect(prepareLiveAnalyzerResolution({ raw })).rejects.toMatchObject({ code: "IDENTITY_CONFLICT" });
    expect(fetch).not.toHaveBeenCalled();
  });
  it("recognizes exact token URL identity without provider provenance claims", () => {
    expect(resolveAnalyzerInput({ raw: `https://birdeye.so/token/${mint}?chain=solana` })).toMatchObject({ tokenAddress: mint, chain: "solana", source: "birdeye.so" });
    expect(resolveAnalyzerInput({ raw: `https://gmgn.ai/sol/token/${mint}` })).toMatchObject({ tokenAddress: mint, chain: "solana" });
  });
  it.each([
    { chainId: "ethereum", pairAddress: evmPool },
    { chainId: "base", pairAddress: quoteToken },
  ])("rejects cross-chain or wrong pair response %j", async (identity) => {
    vi.stubGlobal("fetch", vi.fn(async () => json({ pairs: [{ ...identity, baseToken: { address: token }, quoteToken: { address: quoteToken } }] })));
    await expect(prepareLiveAnalyzerResolution({ raw: `https://dexscreener.com/base/${evmPool}` })).rejects.toMatchObject({ code: "IDENTITY_CONFLICT" });
  });
  it("rejects a token lookup returning another token and preserves Solana case", async () => {
    vi.stubGlobal("fetch", vi.fn(async () => json({ pairs: [{ chainId: "solana", pairAddress: pool, baseToken: { address: mint.toLowerCase() } }] })));
    await expect(prepareLiveAnalyzerResolution({ raw: mint, hintChain: "solana" })).rejects.toMatchObject({ code: "IDENTITY_CONFLICT" });
  });
  it("returns provider response identity for server attestation without caller-authored proof", async () => {
    vi.stubGlobal("fetch", vi.fn(async () => json({ pairs: [{ chainId: "base", pairAddress: evmPool, baseToken: { address: token }, quoteToken: { address: quoteToken } }] })));
    expect((await prepareLiveAnalyzerResolution({ raw: `https://dexscreener.com/base/${evmPool}` })).resolution).toMatchObject({ tokenAddress: token, pairAddress: evmPool, resolvedBaseToken: token, resolvedQuoteToken: quoteToken });
    expect((await prepareLiveAnalyzerResolution({ raw: `https://dexscreener.com/base/${evmPool}` })).resolution).not.toHaveProperty("pairProof");
  });
});

describe("Solana Mint verification and supply-based distribution", () => {
  it.each([TOKEN_PROGRAM, TOKEN_2022_PROGRAM])("verifies initialized 82-byte Mint for %s", (owner) => {
    expect(verifySolanaMint(account(mintBytes(), owner))).toMatchObject({ tokenProgram: owner, supply: "1000", decimals: "6" });
  });
  it("accepts a Token-2022 Mint envelope and rejects token account type", () => {
    const bytes = Buffer.alloc(170); mintBytes().copy(bytes); bytes[165] = 1;
    expect(verifySolanaMint(account(bytes, TOKEN_2022_PROGRAM))).not.toBeNull();
    bytes[165] = 2; expect(verifySolanaMint(account(bytes, TOKEN_2022_PROGRAM))).toBeNull();
  });
  it.each([
    account(Buffer.alloc(165), "11111111111111111111111111111111"),
    account(Buffer.alloc(165)), account(Buffer.alloc(82)), account(Buffer.alloc(166, 255)),
    account(mintBytes(), "invalid-owner"), { ...account(), owner: [TOKEN_PROGRAM] }, null, { owner: TOKEN_PROGRAM, data: ["%%%", "base64"] },
  ])("rejects fake/non-mint/missing account %#", (value) => { expect(verifySolanaMint(value)).toBeNull(); });
  it("reproduces System-owned 165-byte failure through the actual collector", async () => {
    vi.stubEnv("SOLANA_RPC_URL", "https://controlled.invalid"); vi.stubEnv("BIRDEYE_API_KEY", "");
    const bytes = Buffer.alloc(165); bytes[0] = 1; bytes.fill(1, 4, 36); bytes[46] = 1; bytes.fill(2, 50, 82);
    vi.stubGlobal("fetch", vi.fn(async (url) => String(url).includes("dexscreener") ? json({ pairs: [] }) : json({ result: { value: account(bytes, "11111111111111111111111111111111") } })));
    const result = await collectLiveAnalyzerEvidence({ raw: mint }, await prepareLiveAnalyzerResolution({ raw: mint }));
    expect(result.manifest.observations).toEqual([]);
    expect(result.usage.filter((u) => u.provider === "helius")).toHaveLength(1);
  });
  it.each([[ [TOKEN_PROGRAM] ], [{ program: TOKEN_PROGRAM }], [null], ["TokenkegQf"]])("does not promote malformed Solana owner %j", async (owner) => {
    vi.stubEnv("SOLANA_RPC_URL", "https://controlled.invalid"); vi.stubEnv("BIRDEYE_API_KEY", "");
    vi.stubGlobal("fetch", vi.fn(async (url) => String(url).includes("dexscreener") ? json({ pairs: [] }) : json({ result: { value: account(mintBytes(), owner) } })));
    const result = await collectLiveAnalyzerEvidence({ raw: mint }, await prepareLiveAnalyzerResolution({ raw: mint }));
    expect(result.statuses.find((item) => item.capability === "TOKEN_PROGRAM_OWNED")?.status).not.toBe("SUPPORTED");
  });
  it("100 + 100 / TOTAL_SUPPLY 1000 is 0.2; exclusions do not change denominator", () => {
    const rows = [{ address: mint, balance: "100" }, { address: pool, balance: "100" }];
    expect(totalSupplyShare(rows, "1000")).toBe("0.2");
    expect(totalSupplyShare(rows, "1000", 10, [pool])).toBe("0.1");
    expect(totalSupplyShare(rows, "0")).toBeNull(); expect(totalSupplyShare(rows, null)).toBeNull();
  });
});

describe("actual adapter scopes and Pump transport", () => {
  it("retains token liquidity 1000 and pool liquidity 100 without false attribution", async () => {
    vi.stubEnv("BIRDEYE_API_KEY", "controlled"); vi.stubEnv("SOLANA_RPC_URL", "https://controlled.invalid");
    const curve = Buffer.alloc(81); Buffer.from([23,183,248,55,96,216,172,96]).copy(curve); curve.writeBigUInt64LE(BigInt(1000), 8); curve.writeBigUInt64LE(BigInt(1000), 40);
    const curveEnvelope = { result: { value: account(curve, PUMP_PROGRAM_ID) } };
    vi.stubGlobal("fetch", vi.fn(async (url, init) => {
      if (String(url).includes("dexscreener")) return json({ pairs: [{ chainId: "solana", pairAddress: pool, baseToken: { address: mint }, quoteToken: { address: pool }, liquidity: { usd: 100 }, priceUsd: "1", volume: { h24: 50 } }] });
      if (String(url).includes("birdeye")) return json({ data: { address: mint, liquidity: 1000, price: 2, volume24h: 500 } });
      const body = JSON.parse(String(init?.body));
      if (body.method === "getTokenLargestAccounts") return json({ result: { value: [{ address: mint, amount: "100" }, { address: pool, amount: "100" }] } });
      return json(body.params[0] === mint ? { result: { value: account() } } : curveEnvelope);
    }));
    const input = { raw: `https://dexscreener.com/solana/${pool}` };
    const result = await collectLiveAnalyzerEvidence(input, await prepareLiveAnalyzerResolution(input));
    const liq = result.manifest.observations.filter((o) => o.key === "liquidity");
    expect(liq).toHaveLength(2);
    expect(liq[0]).toMatchObject({ value: "100", context: { scope: "PAIR", poolId: pool } });
    expect(liq[1]).toMatchObject({ value: "1000", identity: mint, context: { scope: "TOKEN_AGGREGATE", poolId: null } });
    expect(result.manifest.providerConflicts.find((c) => c.capability === "liquidity")?.explanation).toContain("AGGREGATED_VS_SINGLE_POOL");
    expect(result.manifest.observations.find((o) => o.key === "concentration")).toMatchObject({ value: "0.2", evidenceClass: "STRONG_SIGNAL", context: { classification: "OBJECTIVE_DERIVED", denominatorType: "TOTAL_SUPPLY", denominatorValue: "1000", completeness: "PARTIAL", returnedAccountCount: 2 } });
    const radar = await collectPumpLifecycle({ mint, request: async () => curveEnvelope });
    const lifecycle = result.manifest.observations.find((o) => o.key === "lifecycle");
    expect(radar.decode.valid).toBe(true);
    expect(lifecycle).toMatchObject({ value: "PUMP_BONDING_CURVE_STAGE", context: { curveAddress: derivePumpBondingCurveAddress(mint), complete: radar.decode.complete.value, virtualTokenReserves: radar.decode.virtualTokenReserves.value, tokenProgram: PUMP_PROGRAM_ID } });
    expect(result.manifest.observations.some((o) => o.key === "transactions")).toBe(false);
    const price = result.manifest.observations.find((o) => o.key === "price")!;
    for (const key of ["price", "liquidity", "marketCap", "fdv", "volume"]) {
      const left = { ...price, key }, right = { ...left, evidenceId: "comparison", source: "other", value: "99" };
      expect(compareMarketObservations([left, right])[0].state).toBe("DISAGREEMENT");
    }
  });
});

describe("real outbound attempt accounting", () => {
  it.each([[401, 1, "HTTP_ERROR"], [429, 1, "RATE_LIMIT"], [503, 2, "HTTP_ERROR"]] as const)("HTTP %s counts exactly %s attempts", async (status, attempts, outcome) => {
    const transport = vi.fn(async () => json({}, status)); vi.stubGlobal("fetch", transport);
    const usage: AnalyzerProviderUsage[] = [];
    expect(await jsonRequest("https://controlled.invalid", {}, "test", "MARKET", usage)).toBeNull();
    expect(transport).toHaveBeenCalledTimes(attempts);
    expect(usage[0]).toMatchObject({ attempts, requestOutcome: outcome, capabilityStatus: "UNKNOWN" });
  });
  it.each(["rpc-error", "invalid-json", "timeout"])("%s is not SUCCESS and is not retried", async (kind) => {
    vi.stubGlobal("fetch", vi.fn(async () => { if (kind === "timeout") throw new DOMException("secret credential URL", "AbortError"); return kind === "rpc-error" ? json({ error: { message: "secret" } }) : new Response("bad"); }));
    const usage: AnalyzerProviderUsage[] = [];
    expect(await jsonRequest("https://controlled.invalid", {}, "test", "TOKEN_IDENTITY", usage)).toBeNull();
    expect(usage[0].attempts).toBe(1); expect(usage[0].status).toBe("FAILED");
    expect(JSON.stringify(usage)).not.toContain("secret");
  });
});
