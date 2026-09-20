import { spawn } from "node:child_process";
import { randomUUID } from "node:crypto";
import type { SupabaseClient } from "@supabase/supabase-js";
import { afterAll, beforeAll, describe, expect, it, vi } from "vitest";
import { createAuditDatabase, dropAuditDatabase, sql, sqlArgs, command, authSql } from "../supabase/tests/scripts/analyzer-local-db.mjs";
import { resolveAnalyzerInput } from "@/lib/token-analyzer/input-resolver";
import policy from "@/lib/token-analyzer/persistence-policy.json";

vi.mock("server-only", () => ({}));
const context = vi.hoisted(() => ({ userId: "", client: null as SupabaseClient | null }));
vi.mock("@/lib/auth/authorization", () => ({ getAuthorizationContext: async () => ({ userId: context.userId, roles: ["admin"], permissions: [], supabase: context.client }) }));
vi.mock("@/lib/token-analyzer/live-intelligence", async () => {
  const { resolveAnalyzerInput } = await import("@/lib/token-analyzer/input-resolver");
  const { createEvidenceManifest } = await import("@/lib/token-analyzer/evidence");
  return {
    prepareLiveAnalyzerResolution: async (input: { raw: string; hintChain?: "ethereum" | "base" | "bnb" | "solana" | "unknown" }) => ({ resolution: resolveAnalyzerInput(input), seedMarket: null, usage: [], statuses: [] }),
    collectLiveAnalyzerEvidence: async (input: { raw: string; hintChain?: "ethereum" | "base" | "bnb" | "solana" | "unknown" }, prepared: { resolution: ReturnType<typeof resolveAnalyzerInput> }) => ({ manifest: createEvidenceManifest(input, prepared.resolution), usage: [], statuses: [] }),
  };
});
import { runAnalyzer, getAnalyzerDeliveryReceipt } from "@/lib/token-analyzer/server";

const local = process.env.RUN_LOCAL_ANALYZER_INTEGRATION === "1" ? describe : describe.skip;
const quote = (value: unknown) => "'" + String(value).replaceAll("'", "''") + "'";
local("real reservation-first application concurrency", () => {
  let db: string;
  let completions = 0;
  beforeAll(async () => {
    db = await createAuditDatabase();
    context.userId = randomUUID();
    await sql(db, `begin;insert into auth.users(id) values ('${context.userId}');insert into public.profiles(id,display_name) values ('${context.userId}','Analyzer overlap');insert into public.user_roles(user_id,role_id) select '${context.userId}',id from public.roles where key='admin';${authSql(context.userId)}select public.set_token_analyzer_enabled(true);commit;`);
    context.client = { rpc: async (name: string, params: Record<string, unknown> = {}) => {
      const allowed = ["analyzer_read_state","analyzer_reserve_delivery","analyzer_complete_delivery","analyzer_start_fresh_analysis","analyzer_start_reanalysis","analyzer_get_delivery_receipt"];
      if (!allowed.includes(name)) throw new Error("Unexpected RPC");
      if (name === "analyzer_complete_delivery") completions++;
      const named = Object.entries(params).map(([key, value]) => {
        if (!/^p_[a-z_]+$/.test(key)) throw new Error("Unexpected RPC argument");
        return key + " => " + (value === null ? "null" : quote(typeof value === "object" ? JSON.stringify(value) : value)) + (["p_input","p_resolution","p_manifest"].includes(key) ? "::jsonb" : "");
      }).join(",");
      const result = await command(sqlArgs(db), `begin;set local application_name='analyzer_contract_overlap';${authSql(context.userId)}select public.${name}(${named});commit;`);
      if (result.code) return { data: null, error: { code: "SQL_TEST_FAILURE", message: result.stderr } };
      return { data: JSON.parse(result.stdout.trim().split("\n").filter((line: string) => line.startsWith("{")).at(-1)!), error: null };
    } } as unknown as SupabaseClient;
    const registry = JSON.parse(await sql(db, "select public.analyzer_contract_registry()")) as typeof policy;
    expect(registry.versions).toEqual(policy.versions);
    expect(registry.fields.price).toEqual(policy.fields.price);
    expect(registry.fields.marketCap).toEqual(policy.fields.marketCap);
  }, 120000);
  afterAll(async () => { if (db) await dropAuditDatabase(db); context.client = null; });
  it.each([2, 5])("%i default callers contend, capture once and replay one exact receipt", async (count) => {
    const input = { raw: "0x" + String(count).padStart(40, "0"), hintChain: "ethereum" as const };
    const resolution = resolveAnalyzerInput(input);
    const requestContext = { actor: context.userId, input, chain: resolution.chain, token: resolution.canonicalTokenId, inputType: resolution.inputType, pair: null, pool: null, versions: policy.versions, mode: "DETERMINISTIC", config: { ai: false, social: false, escalation: false } };
    const key = await sql(db, `select public.analyzer_compute_delivery_key(public.analyzer_canonical_json(${quote(JSON.stringify(requestContext))}::jsonb))`);
    const barrier = spawn("docker", sqlArgs(db));
    let output = "";
    const ready = new Promise<void>((resolve, reject) => {
      barrier.stdout.on("data", (chunk) => { output += chunk; if (output.includes("LOCK_READY")) resolve(); });
      barrier.on("error", reject);
    });
    barrier.stdin.write(`begin;select pg_advisory_xact_lock(hashtextextended('${key}',0));select 'LOCK_READY';\n`);
    await ready;
    const before = completions, capturesBefore = Number(await sql(db, "select count(*) from public.analyzer_evidence_manifests"));
    const calls: Promise<unknown>[] = [];
    let waiting = 0;
    try {
      for (let i = 0; i < count; i++) {
        calls.push(runAnalyzer(input));
        await new Promise((resolve) => setTimeout(resolve, 10));
      }
      for (let i = 0; i < 100; i++) {
        waiting = Number(await sql(db, "select count(*) from pg_stat_activity where application_name='analyzer_contract_overlap' and wait_event_type='Lock' and cardinality(pg_blocking_pids(pid))>0"));
        if (waiting === count) break;
        await new Promise((resolve) => setTimeout(resolve, 25));
      }
    } finally { barrier.stdin.end("commit;\n"); }
    const results = await Promise.all(calls);
    expect(waiting).toBe(count);
    expect(results.every((value) => JSON.stringify(value) === JSON.stringify(results[0]))).toBe(true);
    expect(completions - before).toBe(1);
    expect(Number(await sql(db, "select count(*) from public.analyzer_evidence_manifests")) - capturesBefore).toBe(1);
    const first = results[0] as Awaited<ReturnType<typeof runAnalyzer>>;
    expect(await getAnalyzerDeliveryReceipt(first.deliveryId!)).toEqual(first);
    expect(await runAnalyzer(input)).toEqual(first);
    expect(await sql(db, `select count(*)||':'||max(analysis_version) from public.analyzer_analyses where request_id='${first.requestId}'`)).toBe("1:1");
  }, 60000);
  it("fresh and same-evidence explicit reanalysis retain independent key-only receipts", async () => {
    const input = { raw: "0x0000000000000000000000000000000000000009", hintChain: "ethereum" as const };
    const d1 = await runAnalyzer(input);
    const d2 = await runAnalyzer(input, { operation: "FRESH_ANALYSIS", intentId: randomUUID() });
    const d3 = await runAnalyzer(input, { operation: "EXPLICIT_REANALYSIS", intentId: randomUUID(), sourceDeliveryId: d2.deliveryId, reanalysisReason: "Contract regression" });
    expect([d1.analysisVersion,d2.analysisVersion,d3.analysisVersion]).toEqual([1,2,3]);
    expect(d2.evidenceManifestHash).toBe(d3.evidenceManifestHash);
    expect(d2.deliveryId).not.toBe(d3.deliveryId);
    for (const original of [d1,d2,d3]) expect(await getAnalyzerDeliveryReceipt(original.deliveryId!)).toEqual(original);
  });
});
