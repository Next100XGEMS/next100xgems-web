// LOCAL ONLY. Uses Docker and disposable scratch databases; never the project
// database's data. No remote connection or credential is accepted.
import assert from "node:assert/strict";
import { spawn } from "node:child_process";
import { randomUUID } from "node:crypto";
import { readFile, readdir } from "node:fs/promises";
import process from "node:process";

const container = "supabase_db_next100xgems-web_2";
const created = new Set();
let checks = 0;

function command(args, input = "") {
  return new Promise((resolve, reject) => {
    const child = spawn("docker", args, { stdio: ["pipe", "pipe", "pipe"] });
    let stdout = "", stderr = "";
    child.stdout.on("data", (chunk) => { stdout += chunk; });
    child.stderr.on("data", (chunk) => { stderr += chunk; });
    child.on("error", reject);
    child.on("close", (code) => resolve({ code, stdout, stderr }));
    child.stdin.on("error", () => {});
    child.stdin.end(input);
  });
}

const sqlArgs = (db) => ["exec", "-i", container, "psql", "-X", "-qAt", "-U", "postgres", "-d", db,
  "-v", "ON_ERROR_STOP=1", "-v", "VERBOSITY=verbose"];
async function sql(db, text, expectedCode = 0) {
  const result = await command(sqlArgs(db), text);
  assert.equal(result.code, expectedCode, result.stderr);
  return result.stdout.trim();
}
function pass(label) { checks++; console.log("PASS: " + label); }

async function main() {
  assert.ok(!process.env.DOCKER_HOST || process.env.DOCKER_HOST.startsWith("unix://"), "Refusing nonlocal Docker host");
  const context = await command(["context", "inspect", "--format", "{{.Endpoints.docker.Host}}"]);
  assert.equal(context.code, 0, context.stderr);
  assert.ok(context.stdout.trim().startsWith("unix://"), "Refusing nonlocal Docker context");

  const dump = await command(["exec", container, "pg_dump", "-U", "postgres", "-d", "postgres",
    "--schema-only", "--no-owner", "--no-privileges", "--schema=auth", "--schema=extensions"]);
  assert.equal(dump.code, 0, dump.stderr);
  const migrationsDir = new URL("../../migrations/", import.meta.url);
  const migrations = await Promise.all((await readdir(migrationsDir)).filter((file) => file.endsWith(".sql")).sort()
    .map((file) => readFile(new URL(file, migrationsDir), "utf8")));
  assert.equal(migrations.length, 20, "Review Radar harness when migration inventory changes");

  const db = "next100xgems_gate19cf1_" + randomUUID().replaceAll("-", "").slice(0, 12);
  assert.match(db, /^next100xgems_gate19cf1_[a-f0-9]{12}$/);
  await sql("postgres", "create database " + db + ";");
  created.add(db);
  await sql(db, dump.stdout);
  for (const migration of migrations) await sql(db, migration);
  pass("Independent scratch database replays all twenty real migrations");

  const owner = "2a000000-0000-4000-8000-000000000001";
  const token = "2a000000-0000-4000-8000-000000000100";
  const token2 = "2a000000-0000-4000-8000-000000000101";
  await sql(db, `
    insert into auth.users(id) values ('${owner}');
    insert into public.profiles(id, display_name, status) values ('${owner}', 'Radar race owner', 'ACTIVE');
    insert into public.user_roles(user_id, role_id) select '${owner}', id from public.roles where key='owner';
    insert into public.tokens(id, chain, contract_address, symbol, name) values
      ('${token}', 'eip155:1', '0x9999999999999999999999999999999999999999', 'RACE', 'Race token'),
      ('${token2}', 'eip155:1', '0x8888888888888888888888888888888888888888', 'RACE2', 'Race token two');
    update public.feature_flags set enabled=case key when 'radar_enabled' then true when 'maintenance_mode' then false when 'radar_emergency_paused' then false else enabled end,
      configuration=case when key='radar_emergency_paused' then '{"generation":1}'::jsonb else configuration end
      where key in ('radar_enabled','maintenance_mode','radar_emergency_paused');
  `);

  const event = await sql(db, `select public.radar_system_insert_event('race-event','DISCOVERY','${token}','race_provider','race-source','${"a".repeat(64)}','{}',clock_timestamp()-interval '1 hour');`);
  const work = await sql(db, `select public.radar_system_enqueue_work('race-screen','SCREENING','${token}','${event}',null,'contract-v1','input-v1',now());`);
  const claimA = (await sql(db, "select * from public.radar_system_claim_work('race-worker-a',300);")).split("|");
  assert.equal(claimA.length, 6);
  await sql(db, `update public.radar_work_items set lease_expires_at=clock_timestamp()-interval '1 second' where id='${work}';`);
  const claimB = (await sql(db, "select * from public.radar_system_claim_work('race-worker-b',300);")).split("|");
  assert.equal(claimB.length, 6);
  const inputHash = await sql(db, `select input_hash from public.radar_work_items where id='${work}';`);
  await sql(db, `select public.radar_system_complete_screening('${work}','race-worker-b','${claimB[3]}',${claimB[4]},'PASS','[]','${inputHash}',clock_timestamp());`);
  const stale = await command(sqlArgs(db), `select public.radar_system_complete_screening('${work}','race-worker-a','${claimA[3]}',${claimA[4]},'PASS','[]','${inputHash}',clock_timestamp());`);
  assert.notEqual(stale.code, 0); assert.ok(stale.stderr.includes("40001"), stale.stderr);
  pass("Separate sessions fence a stale worker after lease recovery");

  const equivalent = await Promise.all([
    command(sqlArgs(db), `select public.radar_system_enqueue_work('race-equivalent','SCREENING','${token2}','${event}',null,'contract-v1','input-v1',now());`),
    command(sqlArgs(db), `select public.radar_system_enqueue_work('race-equivalent','SCREENING','${token2}','${event}',null,'contract-v1','input-v1',now());`),
  ]);
  assert.ok(equivalent.every((result) => result.code === 0), equivalent.map((result) => result.stderr).join("\n"));
  assert.equal(equivalent[0].stdout.trim(), equivalent[1].stdout.trim());
  pass("Equivalent work enqueue requests converge across sessions");

  const conflicting = await Promise.all([
    command(sqlArgs(db), `select public.radar_system_enqueue_work('race-conflict','SCREENING','${token2}','${event}',null,'method-a','input-v1',now());`),
    command(sqlArgs(db), `select public.radar_system_enqueue_work('race-conflict','SCREENING','${token2}','${event}',null,'method-b','input-v1',now());`),
  ]);
  assert.equal(conflicting.filter((result) => result.code === 0).length, 1);
  assert.equal(conflicting.filter((result) => result.code !== 0 && result.stderr.includes("23505")).length, 1);
  pass("Conflicting idempotency-key enqueue requests do not collapse");

  const pauseWork = await sql(db, `select public.radar_system_enqueue_work('race-pause','SCREENING','${token}',null,null,'contract-v1','input-v1',now());`);
  await sql(db, "update public.radar_work_items set available_at=now()+interval '1 day' where request_key in ('race-equivalent','race-conflict');");
  const pauseClaim = (await sql(db, "select * from public.radar_system_claim_work('pause-worker',300);")).split("|");
  await sql(db, "update public.feature_flags set enabled=true, configuration='{\"generation\":2}'::jsonb where key='radar_emergency_paused';");
  const paused = await command(sqlArgs(db), `select public.radar_system_complete_screening('${pauseWork}','pause-worker','${pauseClaim[3]}',${pauseClaim[4]},'PASS','[]',(select input_hash from public.radar_work_items where id='${pauseWork}'),clock_timestamp());`);
  assert.notEqual(paused.code, 0); assert.ok(paused.stderr.includes("55000"), paused.stderr);
  pass("Separate session pause-generation change rejects an active old worker");
}

try { await main(); console.log("Radar concurrency checks: " + checks + "/" + checks + " PASS"); }
catch (error) { console.error(error.message); process.exitCode = 1; }
finally {
  for (const db of created) {
    try { await sql("postgres", "drop database " + db + ";"); }
    catch (error) { console.error("Scratch cleanup blocked for " + db + ": " + error.message); process.exitCode = 1; }
  }
  if (created.size) console.log("Removed only this run's disposable Radar validation database.");
}
