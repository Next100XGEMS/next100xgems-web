// LOCAL ONLY. Verifies the migration-26 -> migration-27 Analyzer upgrade.
import assert from "node:assert/strict";
import { spawn } from "node:child_process";
import { randomUUID } from "node:crypto";
import { readFile, readdir } from "node:fs/promises";

const container = "supabase_db_next100xgems-web_2";
const created = new Set();

function command(args, input = "") {
  return new Promise((resolve, reject) => {
    const child = spawn("docker", args, { stdio: ["pipe", "pipe", "pipe"] });
    let stdout = "";
    let stderr = "";
    child.stdout.on("data", (chunk) => { stdout += chunk; });
    child.stderr.on("data", (chunk) => { stderr += chunk; });
    child.on("error", reject);
    child.on("close", (code) => resolve({ code, stdout, stderr }));
    child.stdin.on("error", () => {});
    child.stdin.end(input);
  });
}

function sqlArgs(database) {
  return ["exec", "-i", container, "psql", "-X", "-qAt", "-U", "postgres", "-d", database, "-v", "ON_ERROR_STOP=1"];
}

async function sql(database, statement) {
  const result = await command(sqlArgs(database), statement);
  assert.equal(result.code, 0, result.stderr);
  return result.stdout.trim();
}

const resolution = {
  inputType: "CONTRACT_ADDRESS",
  source: "direct-input",
  chain: "ethereum",
  tokenAddress: "0x0000000000000000000000000000000000000001",
  canonicalTokenId: "ethereum:0x0000000000000000000000000000000000000001",
  pairAddress: null,
  poolAddress: null,
  symbol: null,
  name: null,
  decimals: null,
  supply: null,
  launchpad: null,
  creator: null,
  creationTimestamp: null,
  programOrContract: null,
  confidence: "CANDIDATE_IDENTITY",
  provenance: [],
};

const manifest = {
  schemaVersion: "token-analyzer-v1",
  manifestFormatVersion: 1,
  evidenceRevision: 1,
  capturedAt: "2026-09-20T00:00:00Z",
  input: { type: "CONTRACT_ADDRESS", rawHash: "aaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaa" },
  resolvedToken: resolution,
  observations: [],
  claims: [],
  providerConflicts: [],
  missing: [],
  freshness: { state: "UNKNOWN", reason: "No explicit freshness policy is available." },
  methodologyVersion: null,
};

const result = {
  requestId: "00000000-0000-0000-0000-000000000000",
  status: "INSUFFICIENT_DATA",
  input: { raw: resolution.tokenAddress, hintChain: "ethereum" },
  resolvedToken: resolution,
  chain: "ethereum",
  pair: { address: null, pool: null },
  freshness: manifest.freshness,
  dataConfidence: { state: "UNKNOWN", coverage: 0, reason: "No evidence." },
  evidenceSummary: { total: 0, available: 0, unknown: 0, sources: [] },
  score: { value: null, max: 100, methodologyVersion: null, status: "METHODOLOGY_NOT_ACTIVE", components: {} },
  market: {}, liquidity: {}, holders: {}, creator: {}, activity: {}, topTrades: [], whyMoving: [], claimVerification: [], riskFactors: [], unknowns: [],
  positionSizing: { status: "POSITION_SIZE_UNAVAILABLE", riskBudget: null, stopDistancePercent: null, positionNotional: null, reason: "No inputs." },
  aiInterpretation: { status: "DISABLED", provider: null, model: null, content: null }, citations: [], providerConflicts: [], methodologyVersion: null, schemaVersion: "token-analyzer-v1", createdAt: "2026-09-20T00:00:00Z",
};

const payload = {
  fingerprint: "aaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaa",
  raw_input: resolution.tokenAddress,
  input_type: "CONTRACT_ADDRESS",
  requested_chain: "ethereum",
  resolution,
  manifest,
  result,
  status: result.status,
  schema_version: "token-analyzer-v1",
  analysis_mode: "DETERMINISTIC",
  freshness_class: "UNKNOWN",
  freshness_expires_at: "2000-01-01T00:00:00Z",
  methodology_version: null,
  score_engine_version: null,
  identity: { chain: "ethereum", canonicalTokenId: resolution.canonicalTokenId, inputType: resolution.inputType, pairAddress: null, poolAddress: null, schemaVersion: "token-analyzer-v1", methodologyVersion: null, scoreEngineVersion: null, analysisMode: "DETERMINISTIC" },
  operation: "FRESH_ANALYSIS",
};

async function main() {
  const context = await command(["context", "inspect", "--format", "{{.Endpoints.docker.Host}}"]);
  assert.equal(context.code, 0, context.stderr);
  assert.ok(context.stdout.trim().startsWith("unix://"), "refusing nonlocal Docker context");
  const dump = await command(["exec", container, "pg_dump", "-U", "postgres", "-d", "postgres", "--schema-only", "--no-owner", "--no-privileges", "--schema=auth", "--schema=extensions"]);
  assert.equal(dump.code, 0, dump.stderr);
  const migrationFiles = (await readdir(new URL("../../migrations/", import.meta.url))).filter((file) => file.endsWith(".sql")).sort();
  assert.ok(migrationFiles.length >= 27, "expected the current migration set");
  const db = `token_analyzer_upgrade_${randomUUID().replaceAll("-", "").slice(0, 10)}`;
  await sql("postgres", `create database ${db};`);
  created.add(db);
  await sql(db, dump.stdout);
  for (const migration of migrationFiles.slice(0, 26)) await sql(db, await readFile(new URL(`../../migrations/${migration}`, import.meta.url), "utf8"));
  const setup = `
    begin;
    insert into auth.users(id) values ('00000000-0000-0000-0000-000000987704');
    insert into public.profiles(id, display_name) values ('00000000-0000-0000-0000-000000987704', 'Analyzer upgrade admin');
    insert into public.user_roles(user_id, role_id) select '00000000-0000-0000-0000-000000987704', id from public.roles where key = 'admin';
    select set_config('request.jwt.claims', '{"sub":"00000000-0000-0000-0000-000000987704","role":"authenticated"}', true);
    select set_config('request.jwt.claim.sub', '00000000-0000-0000-0000-000000987704', true);
    set local role authenticated;
    select public.set_token_analyzer_enabled(true);
    select public.analyzer_submit_run($json$${JSON.stringify(payload)}$json$::jsonb);
    reset role;
    commit;
    select count(*) from public.analyzer_analyses;
  `;
  const setupResult = await sql(db, setup);
  assert.equal(setupResult.trim().split(/\s+/).at(-1), "1", "migration 26 must create one valid pre-existing analysis");
  await sql(db, await readFile(new URL(`../../migrations/${migrationFiles[26]}`, import.meta.url), "utf8"));
  const preserved = await sql(db, "select count(*) || ':' || count(evidence_revision) || ':' || count(delivery_identity) from public.analyzer_analyses;");
  assert.equal(preserved, "1:1:1", "existing analysis must be backfilled without semantic loss");
  const immutability = await sql(db, "select count(*) from pg_trigger where tgrelid = 'public.analyzer_analyses'::regclass and tgname = 'analyzer_analyses_no_mutation' and not tgisinternal;");
  assert.equal(immutability, "1", "post-upgrade analysis guard must remain installed");
  const update = await command(sqlArgs(db), "update public.analyzer_analyses set status = 'SCORED';");
  assert.notEqual(update.code, 0, "post-upgrade analysis UPDATE must remain blocked");
  const deletion = await command(sqlArgs(db), "delete from public.analyzer_analyses;");
  assert.notEqual(deletion.code, 0, "post-upgrade analysis DELETE must remain blocked");
  const deliveryUpdate = await command(sqlArgs(db), "update public.analyzer_deliveries set operation = 'FRESH_ANALYSIS';");
  assert.notEqual(deliveryUpdate.code, 0, "post-upgrade delivery UPDATE must remain blocked");
  const deliveryDeletion = await command(sqlArgs(db), "delete from public.analyzer_deliveries;");
  assert.notEqual(deliveryDeletion.code, 0, "post-upgrade delivery DELETE must remain blocked");
  console.log("Token Analyzer populated upgrade: PASS");
}

try { await main(); }
catch (error) { console.error(error.stack || error.message); process.exitCode = 1; }
finally {
  for (const db of created) {
    try { await sql("postgres", `drop database ${db};`); }
    catch (error) { console.error(`Scratch cleanup blocked for ${db}: ${error.message}`); process.exitCode = 1; }
  }
}
