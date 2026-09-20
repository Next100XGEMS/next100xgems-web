import { spawn } from "node:child_process";
import { createServer, type Server } from "node:http";
import { once } from "node:events";
import { randomUUID } from "node:crypto";
import type { SupabaseClient } from "@supabase/supabase-js";
import { afterAll, beforeAll, describe, expect, it, vi } from "vitest";
import { createAuditDatabase, dropAuditDatabase, sql, sqlArgs, command, authSql } from "../supabase/tests/scripts/analyzer-local-db.mjs";
import { resolveAnalyzerInput } from "@/lib/token-analyzer/input-resolver";
import policy from "@/lib/token-analyzer/persistence-policy.json";
import { TOKEN_PROGRAM } from "@/lib/token-analyzer/provider-integrity";
import { sha256 } from "@/lib/radar/hash";

vi.mock("server-only", () => ({}));
const context = vi.hoisted(() => ({ userId: "", db: "", client: null as SupabaseClient | null }));
vi.mock("@/lib/auth/authorization", () => ({ getAuthorizationContext: async () => ({ userId: context.userId, roles: ["admin"], permissions: [], supabase: context.client }) }));
vi.mock("@/lib/token-analyzer/trusted-resolution", () => ({
  attestAnalyzerResolution: async ({ deliveryKey, input, resolution, providerResponse }: { deliveryKey: string; input: unknown; resolution: unknown; providerResponse: unknown }) => {
    const named = (value: unknown) => "'" + JSON.stringify(value).replaceAll("'", "''") + "'::jsonb";
    const result = await command(sqlArgs(context.db), `begin;set local role service_role;select public.analyzer_attest_resolution('${deliveryKey}',${named(input)},${named(resolution)},'${sha256({ providerResponse })}','token-analyzer-live-collector-v2');commit;`);
    if (result.code) throw new Error(result.stderr);
    return JSON.parse(result.stdout.trim().split("\n").at(-1) ?? "null");
  },
}));
import { runAnalyzer, getAnalyzerDeliveryReceipt, getAnalyzerProviderTelemetry } from "@/lib/token-analyzer/server";

const local = process.env.RUN_LOCAL_ANALYZER_INTEGRATION === "1" ? describe : describe.skip;
const quote = (value: unknown) => "'" + String(value).replaceAll("'", "''") + "'";
local("real reservation-first application concurrency", () => {
  let db: string;
  let completions = 0, outbound = 0, dexCalls = 0;
  let providerServer: Server;
  const originalFetch = globalThis.fetch;
  let telemetryBarrier: Promise<void> | null = null;
  let releaseTelemetry: (() => void) | null = null;
  const pair = "0x" + "a".repeat(40), quoteToken = "0x" + "b".repeat(40);
  const solMint = "So11111111111111111111111111111111111111112", solPool = "DYDXN8tmpQf2K64wpxKfndV8o7cgicGxsSM2WGWky3Rf";
  beforeAll(async () => {
    providerServer = createServer(async (request, response) => {
      outbound++;
      const chunks: Buffer[] = [];
      for await (const chunk of request) chunks.push(Buffer.from(chunk));
      response.setHeader("content-type", "application/json");
      if (request.url?.startsWith("/dex/") || request.url?.startsWith("/pair/")) {
        dexCalls++;
        const token = request.url.split("/").at(-1)!;
        const sol = !token.startsWith("0x");
        response.end(JSON.stringify({ pairs: [{ chainId: sol ? "solana" : "ethereum", pairAddress: sol ? solPool : request.url.startsWith("/pair/") ? token : pair, baseToken: { address: sol ? solMint : request.url.startsWith("/pair/") ? "0x0000000000000000000000000000000000000009" : token }, quoteToken: { address: sol ? solPool : quoteToken }, priceUsd: "1", liquidity: { usd: 100 }, volume: { h24: 50 }, txns: { h24: { buys: 2, sells: 3 } } }] }));
      } else if (request.url === "/birdeye") {
        response.end(JSON.stringify({ data: { address: solMint, liquidity: 1000, price: 2, volume24h: 500 } }));
      } else {
        const body = JSON.parse(Buffer.concat(chunks).toString());
        if (body.method === "getAccountInfo") {
          const bytes = Buffer.alloc(82); bytes[45] = 1; bytes[44] = 6; bytes.writeBigUInt64LE(BigInt(1000), 36);
          response.end(JSON.stringify({ result: { value: body.params[0] === solMint ? { owner: TOKEN_PROGRAM, executable: false, data: [bytes.toString("base64"), "base64"] } : null } })); return;
        }
        if (body.method === "getTokenLargestAccounts") { response.end(JSON.stringify({ result: { value: [{ address: solMint, amount: "100" }, { address: solPool, amount: "100" }] } })); return; }
        response.end(JSON.stringify({ result: body.method === "eth_getCode" ? "0x6001" : "0x" + (body.params[0]?.data === "0x313ce567" ? "12" : "3e8").padStart(64, "0") }));
      }
    });
    providerServer.listen(0, "127.0.0.1"); await once(providerServer, "listening");
    const port = (providerServer.address() as { port: number }).port;
    vi.stubEnv("ALCHEMY_API_KEY", "controlled-not-a-secret");
    vi.stubEnv("HELIUS_API_KEY", ""); vi.stubEnv("SOLANA_RPC_URL", ""); vi.stubEnv("BIRDEYE_API_KEY", "");
    vi.stubGlobal("fetch", async (input: RequestInfo | URL, init?: RequestInit) => {
      const url = new URL(String(input));
      if (url.hostname === "api.dexscreener.com") return originalFetch(`http://127.0.0.1:${port}/${url.pathname.includes("/pairs/") ? "pair" : "dex"}/${url.pathname.split("/").at(-1)}`, init);
      if (url.hostname.endsWith(".g.alchemy.com")) return originalFetch(`http://127.0.0.1:${port}/rpc`, init);
      if (url.hostname === "controlled.invalid") return originalFetch(`http://127.0.0.1:${port}/rpc`, init);
      if (url.hostname === "public-api.birdeye.so") return originalFetch(`http://127.0.0.1:${port}/birdeye`, init);
      throw new Error("External traffic is forbidden by this test");
    });
  });
  beforeAll(async () => {
    db = await createAuditDatabase();
    context.db = db;
    context.userId = randomUUID();
    await sql(db, `begin;insert into auth.users(id) values ('${context.userId}');insert into public.profiles(id,display_name) values ('${context.userId}','Analyzer overlap');insert into public.user_roles(user_id,role_id) select '${context.userId}',id from public.roles where key='admin';${authSql(context.userId)}select public.set_token_analyzer_enabled(true);commit;`);
    context.client = { rpc: async (name: string, params: Record<string, unknown> = {}) => {
      const allowed = ["analyzer_read_state","analyzer_reserve_delivery","analyzer_complete_delivery","analyzer_start_fresh_analysis","analyzer_start_reanalysis","analyzer_get_delivery_receipt","analyzer_record_provider_event","analyzer_get_provider_telemetry"];
      if (!allowed.includes(name)) throw new Error("Unexpected RPC");
      if (name === "analyzer_complete_delivery") completions++;
      if (name === "analyzer_record_provider_event" && telemetryBarrier) await telemetryBarrier;
      const named = Object.entries(params).map(([key, value]) => {
        if (!/^p_[a-z_]+$/.test(key)) throw new Error("Unexpected RPC argument");
        return key + " => " + (value === null ? "null" : quote(typeof value === "object" ? JSON.stringify(value) : value)) + (["p_input","p_resolution","p_manifest","p_payload"].includes(key) ? "::jsonb" : "");
      }).join(",");
      const result = await command(sqlArgs(db), `begin;set local application_name='analyzer_contract_overlap';${authSql(context.userId)}select public.${name}(${named});commit;`);
      if (result.code) return { data: null, error: { code: "SQL_TEST_FAILURE", message: result.stderr } };
      const line = result.stdout.trim().split("\n").at(-1) ?? "null";
      return { data: line ? JSON.parse(line) : null, error: null };
    } } as unknown as SupabaseClient;
    const registry = JSON.parse(await sql(db, "select public.analyzer_contract_registry()")) as typeof policy;
    expect(registry).toEqual(policy);
    expect(registry.fields.price).toEqual(policy.fields.price);
    expect(registry.fields.marketCap).toEqual(policy.fields.marketCap);
  }, 120000);
  afterAll(async () => { if (db) await dropAuditDatabase(db); context.client = null; context.db = ""; providerServer?.close(); vi.unstubAllGlobals(); vi.unstubAllEnvs(); });
  it.each([[2, false], [5, false], [2, true], [5, true]] as const)("%i default callers (DEX URL=%s) contend, capture once and replay one exact receipt", async (count, dexUrl) => {
    const address = "0x" + String(count).padStart(40, "0");
    const input = { raw: dexUrl ? `https://dexscreener.com/ethereum/${address}` : address, hintChain: "ethereum" as const };
    const resolution = resolveAnalyzerInput(input);
    const requestContext = { actor: context.userId, input, chain: resolution.chain, token: resolution.canonicalTokenId, inputType: resolution.inputType, pair: resolution.pairAddress, pool: resolution.poolAddress, versions: policy.versions, mode: "DETERMINISTIC", config: { ai: false, social: false, escalation: false } };
    const key = await sql(db, `select public.analyzer_compute_delivery_key(public.analyzer_canonical_json(${quote(JSON.stringify(requestContext))}::jsonb))`);
    const barrier = spawn("docker", sqlArgs(db));
    let output = "";
    const ready = new Promise<void>((resolve, reject) => {
      barrier.stdout.on("data", (chunk) => { output += chunk; if (output.includes("LOCK_READY")) resolve(); });
      barrier.on("error", reject);
    });
    barrier.stdin.write(`begin;select pg_advisory_xact_lock(hashtextextended('${key}',0));select 'LOCK_READY';\n`);
    await ready;
    const callsBefore = outbound, dexBefore = dexCalls;
    telemetryBarrier = new Promise<void>((resolve) => { releaseTelemetry = resolve; });
    const before = completions, capturesBefore = Number(await sql(db, "select count(*) from public.analyzer_evidence_manifests"));
    const calls: Promise<unknown>[] = [];
    let returned = 0, joinersBeforeTelemetry = false;
    let waiting = 0;
    try {
      for (let i = 0; i < count; i++) {
        calls.push(runAnalyzer(input).then((value) => { returned++; if (returned === count - 1) { joinersBeforeTelemetry = true; releaseTelemetry?.(); } return value; }));
        await new Promise((resolve) => setTimeout(resolve, 10));
      }
      for (let i = 0; i < 100; i++) {
        waiting = Number(await sql(db, "select count(*) from pg_stat_activity where application_name='analyzer_contract_overlap' and wait_event_type='Lock' and cardinality(pg_blocking_pids(pid))>0"));
        if (waiting === count) break;
        await new Promise((resolve) => setTimeout(resolve, 25));
      }
    } finally { barrier.stdin.end("commit;\n"); }
    const emergencyRelease = setTimeout(() => releaseTelemetry?.(), 10000);
    const results = await Promise.all(calls);
    clearTimeout(emergencyRelease); telemetryBarrier = null;
    expect(waiting).toBe(count);
    expect(joinersBeforeTelemetry).toBe(true);
    expect(results.every((value) => JSON.stringify(value) === JSON.stringify(results[0]))).toBe(true);
    expect(completions - before).toBe(1);
    expect(dexCalls - dexBefore).toBe(1);
    expect(outbound - callsBefore).toBe(5); // one DEX + four read-only Alchemy calls
    expect(Number(await sql(db, "select count(*) from public.analyzer_evidence_manifests")) - capturesBefore).toBe(1);
    const first = results[0] as Awaited<ReturnType<typeof runAnalyzer>>;
    expect(await getAnalyzerDeliveryReceipt(first.deliveryId!)).toEqual(first);
    expect(first.providerUsage).toBeUndefined();
    const usage = await getAnalyzerProviderTelemetry(first.deliveryId!);
    expect(usage.filter((u: { requestMade: boolean }) => u.requestMade)).toHaveLength(5);
    expect(usage.every((u: { capabilityStatus: string }) => typeof u.capabilityStatus === "string")).toBe(true);
    const repeatBefore = outbound;
    expect(await runAnalyzer(input)).toEqual(first);
    expect(outbound).toBe(repeatBefore);
    expect(await sql(db, `select count(*)||':'||max(analysis_version) from public.analyzer_analyses where request_id='${first.requestId}'`)).toBe("1:1");
  }, 60000);
  it("fresh and same-evidence explicit reanalysis retain independent key-only receipts", async () => {
    const input = { raw: `https://dexscreener.com/ethereum/${pair}`, hintChain: "ethereum" as const };
    const d1 = await runAnalyzer(input);
    const d2 = await runAnalyzer(input, { operation: "FRESH_ANALYSIS", intentId: randomUUID() });
    const d3 = await runAnalyzer(input, { operation: "EXPLICIT_REANALYSIS", intentId: randomUUID(), sourceDeliveryId: d2.deliveryId, reanalysisReason: "Contract regression" });
    expect([d1.analysisVersion,d2.analysisVersion,d3.analysisVersion]).toEqual([1,2,3]);
    expect(d2.evidenceManifestHash).toBe(d3.evidenceManifestHash);
    expect(d2.deliveryId).not.toBe(d3.deliveryId);
    for (const original of [d1,d2,d3]) expect(await getAnalyzerDeliveryReceipt(original.deliveryId!)).toEqual(original);
    const before = outbound;
    expect(await runAnalyzer(input)).toEqual(d1);
    expect(outbound).toBe(before);
  });
  it("rejects authenticated URL provenance spoof and cross-chain/pair/token proofs at the RPC", async () => {
    const canonical = resolveAnalyzerInput({ raw: "0x0000000000000000000000000000000000000009", hintChain: "ethereum" });
    const spoof = { ...canonical, source: "birdeye.so", inputType: "CHART_URL", confidence: "PARTIAL", provenance: [canonical.provenance[0], canonical.provenance[0]] };
    const rejected = await context.client!.rpc("analyzer_reserve_delivery", { p_input: { raw: "https://attacker.invalid/token/different", hintChain: "ethereum" }, p_resolution: spoof });
    expect(rejected.error).not.toBeNull();
    const input = { raw: `https://dexscreener.com/base/${pair}`, hintChain: "base" as const };
    const initial = resolveAnalyzerInput(input);
    const valid = { ...initial, tokenAddress: canonical.tokenAddress, canonicalTokenId: `base:${canonical.tokenAddress}`, pairProof: { provider: "dex-screener", chain: "base", pair, baseToken: canonical.tokenAddress, quoteToken, selection: "BASE_TOKEN" } };
    for (const proof of [{ ...valid.pairProof, chain: "ethereum" }, { ...valid.pairProof, pair: quoteToken }, { ...valid.pairProof, baseToken: quoteToken }]) {
      expect((await context.client!.rpc("analyzer_reserve_delivery", { p_input: input, p_resolution: { ...valid, pairProof: proof } })).error).not.toBeNull();
    }
    await expect(runAnalyzer(input)).rejects.toMatchObject({ code: "IDENTITY_CONFLICT" });
  });
  it("persists aggregate 1000 and pair 100 separately, with partial 0.2 total-supply share", async () => {
    vi.stubEnv("SOLANA_RPC_URL", "https://controlled.invalid"); vi.stubEnv("BIRDEYE_API_KEY", "controlled");
    const result = await runAnalyzer({ raw: `https://dexscreener.com/solana/${solPool}`, hintChain: "solana" });
    expect(result.liquidity.liquidity).toEqual(expect.arrayContaining([
      expect.objectContaining({ value: "100", context: expect.objectContaining({ scope: "PAIR", poolId: solPool }) }),
      expect.objectContaining({ value: "1000", context: expect.objectContaining({ scope: "TOKEN_AGGREGATE", poolId: null }) }),
    ]));
    expect(result.liquidity.liquidity).toHaveLength(2);
    expect(result.holders.concentration).toEqual([expect.objectContaining({ value: "0.2", evidenceClass: "STRONG_SIGNAL", context: expect.objectContaining({ classification: "OBJECTIVE_DERIVED", completeness: "PARTIAL", denominatorValue: "1000" }) })]);
    expect(await getAnalyzerDeliveryReceipt(result.deliveryId!)).toEqual(result);
    const before = outbound;
    expect(await runAnalyzer({ raw: `https://dexscreener.com/solana/${solPool}`, hintChain: "solana" })).toEqual(result);
    expect(outbound).toBe(before);
  });
});
