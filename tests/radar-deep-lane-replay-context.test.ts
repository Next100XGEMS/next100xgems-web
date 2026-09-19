import { spawn } from "node:child_process";
import { randomUUID } from "node:crypto";
import { readFileSync } from "node:fs";
import { afterAll, beforeAll, describe, expect, it, vi } from "vitest";
vi.mock("server-only", () => ({}));
import { executeDeepLaneWork, prepareDeepLaneRequest, type RadarDeepLaneRequest } from "@/lib/radar/deep-lane";
import { FixtureDeepLaneProvider } from "@/lib/radar/providers/fixture-deep-lane";
import { createRadarSystemGateway, type RadarClaimedWork } from "@/lib/radar/system-gateway";

const containerName = "supabase_db_next100xgems-web_2";
const enabled = process.env.RUN_LOCAL_SUPABASE_TESTS === "1";
const zeroHash = "0".repeat(64);
const oneHash = "1".repeat(64);

function localEnv() {
  const values = Object.fromEntries(readFileSync(".env.local", "utf8").split(/\r?\n/).filter((line) => line && !line.startsWith("#")).map((line) => { const index = line.indexOf("="); return index < 0 ? [line, ""] : [line.slice(0, index), line.slice(index + 1).replace(/^['"]|['"]$/g, "")]; }));
  process.env.SUPABASE_URL ??= values.SUPABASE_URL;
  process.env.SUPABASE_SECRET_KEY ??= values.SUPABASE_SECRET_KEY;
}

async function sql(statement: string) {
  return new Promise<string>((resolve, reject) => {
    const child = spawn("docker", ["exec", "-i", containerName, "psql", "-X", "-qAt", "-U", "postgres", "-d", "postgres", "-v", "ON_ERROR_STOP=1"]);
    let stdout = "";
    let stderr = "";
    child.stdout.on("data", (chunk) => { stdout += chunk; });
    child.stderr.on("data", (chunk) => { stderr += chunk; });
    child.on("error", reject);
    child.on("close", (code) => code === 0 ? resolve(stdout.trim()) : reject(new Error(stderr.trim() || `psql exited with ${code}`)));
    child.stdin.end(statement);
  });
}

const describeLocal = enabled ? describe : describe.skip;

describeLocal("Deep Lane completed receipt context over local RPC", () => {
  const suffix = `f4-${Date.now()}-${Math.random().toString(16).slice(2, 8)}`;
  const tokenId = randomUUID();
  const eventId = randomUUID();
  const observationId = randomUUID();
  let workItemId = "";
  let claimed: RadarClaimedWork;
  let request: RadarDeepLaneRequest;
  let adapter: FixtureDeepLaneProvider;
  let gateway: ReturnType<typeof createRadarSystemGateway>;
  let beforeConflictSnapshot = "";

  beforeAll(async () => {
    if (!enabled) return;
    localEnv();
    gateway = createRadarSystemGateway();
    adapter = new FixtureDeepLaneProvider();
    await sql(`
      insert into public.tokens(id, chain, contract_address, symbol, name)
      values ('${tokenId}', 'eip155:1', '0x${(tokenId.replaceAll("-", "") + "0".repeat(40)).slice(0, 40)}', 'F4TEST', 'F4 replay test token');
      insert into public.radar_events(id, event_key, event_type, token_id, source_provider, source_event_id, payload_hash, canonical_fingerprint, context, observed_at)
      values ('${eventId}', '${suffix}-event', 'OBSERVATION', '${tokenId}', 'fixture', '${suffix}-source', '${zeroHash}', '${oneHash}', '{}', now());
      insert into public.radar_observations(id, event_id, token_id, provider, adapter_version, capability, metric_key, data_state, normalized_value, unit, context, provenance, content_hash, observed_at)
      values ('${observationId}', '${eventId}', '${tokenId}', 'fixture', 'fixture-v1', 'market', 'liquidity', 'AVAILABLE', 123.45, 'USD', '{}', '{"authority":"fixture"}', '${"2".repeat(64)}', now());
      update public.feature_flags
      set enabled = case key when 'radar_enabled' then true when 'maintenance_mode' then false when 'radar_emergency_paused' then false else enabled end,
          configuration = case when key = 'radar_emergency_paused' then '{"generation":1}'::jsonb else configuration end
      where key in ('radar_enabled', 'maintenance_mode', 'radar_emergency_paused');
    `);
    workItemId = await sql(`select public.radar_system_enqueue_work('${suffix}-work', 'DEEP_ANALYSIS', '${tokenId}', '${eventId}', null, 'fixture-method-v1', 'fixture-input-v1', now());`);
    await sql(`select public.radar_system_attach_observation('${workItemId}', '${observationId}'); select public.radar_system_finalize_work_inputs('${workItemId}', 'fixture-method-v1', 'fixture-input-v1');`);
    const claim = (await sql(`select * from public.radar_system_claim_work('f4-replay-worker', 300);`)).split("|");
    expect(claim[0]).toBe(workItemId);
    claimed = { workItemId, workKind: claim[1], tokenId: claim[2], leaseToken: claim[3], leaseGeneration: Number(claim[4]), pauseGeneration: Number(claim[5]), worker: "f4-replay-worker" };
    const manifest = await gateway.getWorkManifest(claimed);
    request = prepareDeepLaneRequest({ workItemId, tokenId, reservedAnalysisVersion: manifest.reservedAnalysisVersion!, methodVersion: manifest.methodVersion!, inputVersion: manifest.inputVersion!, inputManifest: manifest.inputManifest, frozenInputHash: manifest.sealedInputHash, evidence: [{ evidenceId: "f4-evidence", contentHash: "3".repeat(64), classification: "VERIFIED_DATA", statement: "A bounded fixture observation." }], provider: adapter.provider, model: adapter.model, modelRevision: adapter.modelRevision, adapterVersion: adapter.adapterVersion });
  });

  afterAll(async () => {
    if (!enabled || !workItemId) return;
    await sql(`begin; set local session_replication_role = replica; delete from public.radar_deep_lane_attempts where request_id in (select id from public.radar_deep_lane_requests where work_item_id = '${workItemId}'); delete from public.radar_deep_lane_requests where work_item_id = '${workItemId}'; delete from public.radar_work_inputs where work_item_id = '${workItemId}'; delete from public.radar_work_items where id = '${workItemId}'; delete from public.radar_observations where id = '${observationId}'; delete from public.radar_events where id = '${eventId}'; delete from public.tokens where id = '${tokenId}'; commit;`);
  });

  async function snapshot() { return sql(`select (select state from public.radar_work_items where id = '${workItemId}') || '|' || (select state from public.radar_deep_lane_requests where work_item_id = '${workItemId}') || '|' || (select attempt_count::text from public.radar_deep_lane_requests where work_item_id = '${workItemId}') || '|' || (select count(*)::text from public.radar_deep_lane_attempts where request_id = (select id from public.radar_deep_lane_requests where work_item_id = '${workItemId}'));`); }
  async function expectConflict(change: Partial<RadarDeepLaneRequest>) { const before = await snapshot(); await expect(executeDeepLaneWork({ claimed, request: { ...request, requestHash: null, ...change }, adapter, gateway })).rejects.toMatchObject({ code: "DEEP_LANE_CONTEXT_CONFLICT" }); expect(adapter.invocationCount).toBe(1); expect(await snapshot()).toBe(before); }

  it("completes through the real PostgREST/RPC path and replays exactly", async () => {
    const first = await executeDeepLaneWork({ claimed, request, adapter, gateway });
    expect(first.outputHash).toMatch(/^[0-9a-f]{64}$/);
    expect(adapter.invocationCount).toBe(1);
    beforeConflictSnapshot = await snapshot();
    const replay = await executeDeepLaneWork({ claimed, request, adapter, gateway });
    expect(replay.requestHash).toBe(first.requestHash);
    expect(replay.outputHash).toBe(first.outputHash);
    expect(adapter.invocationCount).toBe(1);
    expect(await snapshot()).toBe(beforeConflictSnapshot);
  });

  it("rejects a conflicting token without reusing the receipt", () => expectConflict({ tokenId: randomUUID() }));
  it("rejects a conflicting analysis version without reusing the receipt", () => expectConflict({ reservedAnalysisVersion: request.reservedAnalysisVersion + 1 }));
  it("rejects a conflicting frozen-input hash without reusing the receipt", () => expectConflict({ frozenInputHash: "4".repeat(64) }));
  it("rejects a conflicting work item without reusing the receipt", () => expectConflict({ workItemId: randomUUID() }));
  it("rejects a conflicting task type without reusing the receipt", () => expectConflict({ taskType: "OTHER" as never }));
  it("rejects a conflicting method version without reusing the receipt", () => expectConflict({ methodVersion: "other-method-v1" }));
  it("rejects a conflicting schema version without reusing the receipt", () => expectConflict({ schemaVersion: "other-schema" as never }));
  it("rejects a conflicting provider/model without reusing the receipt", () => expectConflict({ provider: "other-provider", model: "other-model", modelRevision: "other-revision" }));
  it("resolves two concurrent exact replays to the same receipt", async () => {
    const [left, right] = await Promise.all([executeDeepLaneWork({ claimed, request, adapter, gateway }), executeDeepLaneWork({ claimed, request, adapter, gateway })]);
    expect(left.requestHash).toBe(right.requestHash);
    expect(left.outputHash).toBe(right.outputHash);
    expect(adapter.invocationCount).toBe(1);
    expect(await snapshot()).toBe(beforeConflictSnapshot);
  });
});
