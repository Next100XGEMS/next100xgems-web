import { afterAll, beforeAll, describe, expect, it, vi } from "vitest";
import type { SupabaseClient } from "@supabase/supabase-js";
import liveFixture from "./fixtures/radar-acceptance-live-20260920.json";
import { authSql, command, sql, sqlArgs } from "../supabase/tests/scripts/analyzer-local-db.mjs";

vi.mock("server-only", () => ({}));
const context = vi.hoisted(() => ({ userId: "336d85b0-3d3f-43ee-8d52-2a5d6deae343", client: null as SupabaseClient | null }));
vi.mock("@/lib/auth/authorization", () => ({ getAuthorizationContext: async () => ({ userId: context.userId, roles: ["admin"], permissions: [], supabase: context.client }) }));
import { runAnalyzer } from "@/lib/token-analyzer/server";

const live = process.env.RUN_TOKEN_ANALYZER_LIVE === "1" ? describe : describe.skip;
const quote = (value: unknown) => "'" + String(value).replaceAll("'", "''") + "'";
const solana = liveFixture.samples.filter((item) => item.chain === "solana").slice(0, 10);
const base = liveFixture.samples.filter((item) => item.chain === "base")[1] ?? liveFixture.samples.find((item) => item.chain === "base");
const bnb = liveFixture.samples.find((item) => item.chain === "bnb");

live("live deterministic Analyzer smoke", () => {
  beforeAll(async () => {
    process.loadEnvFile?.(".env.local");
    context.client = { rpc: async (name: string, params: Record<string, unknown> = {}) => {
      const allowed = ["analyzer_read_state", "set_token_analyzer_enabled", "analyzer_reserve_delivery", "analyzer_complete_delivery", "analyzer_start_fresh_analysis", "analyzer_start_reanalysis", "analyzer_get_delivery_receipt", "analyzer_record_provider_event"];
      if (!allowed.includes(name)) throw new Error(`Unexpected RPC ${name}`);
      const named = Object.entries(params).map(([key, value]) => `${key} => ${value === null ? "null" : quote(typeof value === "object" ? JSON.stringify(value) : value)}${["p_input", "p_resolution", "p_manifest", "p_payload"].includes(key) ? "::jsonb" : ""}`).join(",");
      const result = await command(sqlArgs("postgres"), `begin;set local application_name='analyzer_live_smoke';${authSql(context.userId)}select public.${name}(${named});commit;`);
      if (result.code) return { data: null, error: { code: "SQL_TEST_FAILURE", message: "local RPC failed" } };
      const line = result.stdout.trim().split("\n").at(-1) ?? "";
      try { return { data: JSON.parse(line), error: null }; } catch { return { data: line === "t", error: null }; }
    } } as unknown as SupabaseClient;
    await sql("postgres", `begin;${authSql(context.userId)}select public.set_token_analyzer_enabled(true);commit;`);
  }, 120000);

  afterAll(async () => { await sql("postgres", `begin;${authSql(context.userId)}select public.set_token_analyzer_enabled(false);commit;`); context.client = null; });

  it("collects the bounded real Solana/EVM/URL smoke set and reuses a sealed delivery", async () => {
    const inputs = [
      ...solana.map((item) => ({ raw: item.tokenAddress, hintChain: "solana" as const })),
      ...solana.slice(0, 3).map((item) => ({ raw: `https://dexscreener.com/solana/${item.poolAddress}`, hintChain: "unknown" as const })),
      ...(base ? [{ raw: base.tokenAddress, hintChain: "base" as const }] : []),
      ...(bnb ? [{ raw: bnb.tokenAddress, hintChain: "bnb" as const }] : []),
      { raw: "0x0000000000000000000000000000000000000001", hintChain: "ethereum" as const },
    ];
    const rows: Array<Record<string, unknown>> = [];
    for (const input of inputs) {
      try {
        const result = await runAnalyzer(input);
        rows.push({ chain: result.chain, status: result.status, available: result.evidenceSummary.available, total: result.evidenceSummary.total, score: result.score.status, delivery: result.deliveryId, usage: result.providerUsage?.length ?? 0, conflicts: result.providerConflicts.length });
      } catch (error) { rows.push({ inputType: "FAILED", error: error instanceof Error ? { name: error.name, message: error.message } : "ERROR" }); }
    }
    const first = inputs[0]; const firstResult = await runAnalyzer(first); const repeated = await runAnalyzer(first);
    expect(repeated.deliveryId).toBe(firstResult.deliveryId);
    expect(repeated.evidenceManifestHash).toBe(firstResult.evidenceManifestHash);
    expect(rows.length).toBe(inputs.length);
    expect(rows.every((row) => row.score === undefined || row.score === "METHODOLOGY_NOT_ACTIVE")).toBe(true);
    console.log(JSON.stringify({ inputs: inputs.length, rows, repeatReused: true }));
  }, 180000);

  it("fails closed with zero provider work when the master flag is OFF", async () => {
    await sql("postgres", "begin;" + authSql(context.userId) + "select public.set_token_analyzer_enabled(false);commit;");
    const fetchSpy = vi.spyOn(globalThis, "fetch");
    await expect(runAnalyzer({ raw: solana[0].tokenAddress, hintChain: "solana" })).rejects.toMatchObject({ code: "FEATURE_DISABLED" });
    expect(fetchSpy).not.toHaveBeenCalled();
    fetchSpy.mockRestore();
  });
});
