import { afterEach, describe, expect, it, vi } from "vitest";
import { collectLiveAnalyzerEvidence, prepareLiveAnalyzerResolution } from "@/lib/token-analyzer/live-intelligence";

vi.mock("server-only", () => ({}));

const mint = "7oWzqiWcRwhzy23DP9ZamxQRcYECt8x1SgiyMhMPEdq2";
const pool = "DYDXN8tmpQf2K64wpxKfndV8o7cgicGxsSM2WGWky3Rf";

afterEach(() => {
  vi.unstubAllEnvs();
  vi.unstubAllGlobals();
});

describe("deterministic live provider routing", () => {
  it("collects typed Solana observations and preserves provider conflicts", async () => {
    vi.stubEnv("SOLANA_RPC_URL", "https://rpc.test");
    vi.stubEnv("HELIUS_API_KEY", "test-helius");
    vi.stubEnv("BIRDEYE_API_KEY", "test-birdeye");
    const calls: string[] = [];
    vi.stubGlobal("fetch", vi.fn(async (input: URL | RequestInfo, init?: RequestInit) => {
      const url = String(input);
      if (url.includes("dexscreener.com")) return new Response(JSON.stringify({ pairs: [{ chainId: "solana", pairAddress: pool, baseToken: { address: mint }, priceUsd: "1.25", liquidity: { usd: 1000 }, volume: { h24: 500 }, txns: { h24: { buys: 3, sells: 2 } }, marketCap: 10000, fdv: 12000 }] }), { status: 200 });
      if (url.includes("birdeye.so")) return new Response(JSON.stringify({ data: { price: "1.50", liquidity: 1000, volume24h: 500, trade24h: 5 } }), { status: 200 });
      if (url.includes("rpc.test")) {
        const body = JSON.parse(String(init?.body ?? "{}")) as { method?: string };
        calls.push(body.method ?? "unknown");
        if (body.method === "getTokenSupply") return new Response(JSON.stringify({ result: { value: { amount: "1000000", decimals: 6 } } }), { status: 200 });
        if (body.method === "getTokenLargestAccounts") return new Response(JSON.stringify({ result: { value: [{ address: mint, amount: "1000000" }] } }), { status: 200 });
        if (body.method === "getAccountInfo") return new Response(JSON.stringify({ result: { value: null } }), { status: 200 });
        return new Response(JSON.stringify({ result: null }), { status: 200 });
      }
      return new Response("{}", { status: 404 });
    }));
    const prepared = await prepareLiveAnalyzerResolution({ raw: mint, hintChain: "solana" });
    const collected = await collectLiveAnalyzerEvidence({ raw: mint, hintChain: "solana" }, prepared);
    expect(collected.manifest.resolvedToken.canonicalTokenId).toBe("solana:" + mint);
    expect(collected.manifest.observations.some((item) => item.key === "supply")).toBe(true);
    expect(collected.manifest.observations.some((item) => item.key === "price")).toBe(true);
    expect(collected.manifest.providerConflicts[0]?.state).toBe("DISAGREEMENT");
    expect(calls).toContain("getTokenSupply");
    expect(collected.usage.some((item) => item.provider === "birdeye" && item.status === "SUCCESS")).toBe(true);
    expect(collected.usage.some((item) => item.provider === "dex-screener" && item.status === "SUCCESS")).toBe(true);
  });

  it("does not present an opaque EVM provider pair id as a canonical pool address", async () => {
    vi.stubEnv("ALCHEMY_API_KEY", "test-alchemy");
    vi.stubGlobal("fetch", vi.fn(async (input: URL | RequestInfo) => {
      const url = String(input);
      if (url.includes("dexscreener.com")) return new Response(JSON.stringify({ pairs: [{ chainId: "bsc", pairAddress: "0xToken:4meme", baseToken: { address: "0x2023c949863bdd874b0743979c374c7d44f0ffff" }, priceUsd: "2.0" }] }), { status: 200 });
      if (url.includes("alchemy.com")) return new Response(JSON.stringify({ result: "0x" + "0".repeat(64) }), { status: 200 });
      return new Response("{}", { status: 404 });
    }));
    const prepared = await prepareLiveAnalyzerResolution({ raw: "0x2023c949863bdd874b0743979c374c7d44f0ffff", hintChain: "bnb" });
    const collected = await collectLiveAnalyzerEvidence({ raw: "0x2023c949863bdd874b0743979c374c7d44f0ffff", hintChain: "bnb" }, prepared);
    expect(collected.manifest.observations.some((item) => item.key === "price")).toBe(true);
    expect(collected.manifest.observations.some((item) => item.key === "pool")).toBe(false);
  });

  it("records a bounded Birdeye rate limit while retaining DEX market fallback", async () => {
    vi.stubEnv("BIRDEYE_API_KEY", "test-birdeye");
    vi.stubGlobal("fetch", vi.fn(async (input: URL | RequestInfo) => {
      const url = String(input);
      if (url.includes("dexscreener.com")) return new Response(JSON.stringify({ pairs: [{ chainId: "solana", pairAddress: pool, baseToken: { address: mint }, priceUsd: "1.25" }] }), { status: 200 });
      if (url.includes("birdeye.so")) return new Response("{}", { status: 429 });
      return new Response("{}", { status: 200 });
    }));
    const prepared = await prepareLiveAnalyzerResolution({ raw: mint, hintChain: "solana" });
    const collected = await collectLiveAnalyzerEvidence({ raw: mint, hintChain: "solana" }, prepared);
    expect(collected.manifest.observations.some((item) => item.key === "price")).toBe(true);
    expect(collected.usage.some((item) => item.provider === "birdeye" && item.status === "RATE_LIMITED")).toBe(true);
    expect(collected.usage.filter((item) => item.provider === "birdeye").length).toBe(1);
  });
});
