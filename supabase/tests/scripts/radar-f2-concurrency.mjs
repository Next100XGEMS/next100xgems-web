// LOCAL ONLY. Replays real migrations into one disposable database and uses
// separate psql sessions to exercise publication lock/revalidation races.
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
async function sql(db, text) {
  const result = await command(sqlArgs(db), text);
  assert.equal(result.code, 0, result.stderr);
  return result.stdout.trim();
}
function pass(label) { checks++; console.log("PASS: " + label); }
function delay(ms) { return new Promise((resolve) => setTimeout(resolve, ms)); }
async function waitForLock(db, applicationName) {
  for (let i = 0; i < 120; i += 1) {
    const waiting = await sql(db, `select count(*) from pg_stat_activity
      where datname=current_database() and application_name='${applicationName}'
        and wait_event_type='Lock';`);
    if (waiting === "1") return;
    await delay(25);
  }
  throw new Error(`no confirmed lock wait for ${applicationName}`);
}
async function hold(db, applicationName, statement) {
  const child = spawn("docker", sqlArgs(db), { stdio: ["pipe", "pipe", "pipe"] });
  let stdout = "", stderr = "";
  child.stdout.on("data", (chunk) => { stdout += chunk; });
  child.stderr.on("data", (chunk) => { stderr += chunk; });
  const done = new Promise((resolve) => child.on("close", (code) => resolve({ code, stderr })));
  child.stdin.write(`begin; set application_name='${applicationName}'; ${statement}; select 'READY';\n`);
  for (let i = 0; i < 120 && !stdout.includes("READY"); i += 1) await delay(25);
  assert.ok(stdout.includes("READY"), stderr);
  return async (commit = false) => {
    child.stdin.end(`${commit ? "commit" : "rollback"};\n`);
    const result = await done;
    assert.equal(result.code, 0, result.stderr);
  };
}
function authenticatedSql(subject, statement) {
  return `begin; set local request.jwt.claims = '{"sub":"${subject}","role":"authenticated"}'; set local request.jwt.claim.sub = '${subject}'; set local role authenticated; ${statement}; commit;`;
}

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
  assert.ok(migrations.length >= 20, "Review F2 harness requires the established migration baseline");
  const db = "next100xgems_gate19cf2_" + randomUUID().replaceAll("-", "").slice(0, 12);
  await sql("postgres", "create database " + db + ";");
  created.add(db);
  await sql(db, dump.stdout);
  for (const migration of migrations) await sql(db, migration);
  pass("F2 scratch database replays the complete real migration set");

  const owner = "4a000000-0000-4000-8000-000000000001";
  const reviewer = "4a000000-0000-4000-8000-000000000002";
  const token = "4a000000-0000-4000-8000-000000000100";
  const observation = "4a000000-0000-4000-8000-000000000101";
  await sql(db, `
    insert into auth.users(id) values ('${owner}'), ('${reviewer}');
    insert into public.profiles(id, display_name, status) values
      ('${owner}', 'F2 race owner', 'ACTIVE'), ('${reviewer}', 'F2 race reviewer', 'ACTIVE');
    insert into public.user_roles(user_id, role_id)
      select '${owner}', id from public.roles where key='owner';
    insert into public.user_roles(user_id, role_id)
      select '${reviewer}', id from public.roles where key='radar_reviewer';
    insert into public.radar_methodology_versions(methodology_version, state, is_test_only, content_hash, approved_at)
      values ('contract-v1', 'APPROVED', true, repeat('a',64), now());
    insert into public.radar_freshness_policies(freshness_policy_version, state, is_test_only, content_hash, approved_at)
      values ('f2-race-freshness', 'APPROVED', true, repeat('b',64), now());
    insert into public.tokens(id, chain, contract_address, symbol, name)
      values ('${token}', 'eip155:1', '0x6666666666666666666666666666666666666666', 'RACEF2', 'F2 race token');
    update public.feature_flags set enabled=case key when 'radar_enabled' then true when 'maintenance_mode' then false when 'radar_emergency_paused' then false else enabled end,
      configuration=case when key='radar_emergency_paused' then '{"generation":1}'::jsonb else configuration end
      where key in ('radar_enabled','maintenance_mode','radar_emergency_paused');
    insert into public.radar_events(id, event_key, event_type, token_id, source_provider, source_event_id, payload_hash, context, observed_at)
      values ('4a000000-0000-4000-8000-000000000110','f2-race-event','DISCOVERY','${token}','f2-race','source',repeat('c',64),'{}',now()-interval '1 hour');
    insert into public.radar_observations(id, event_id, token_id, provider, adapter_version, capability, metric_key, data_state,
      normalized_value, raw_integer_value, decimal_places, unit, context, provenance, content_hash, observed_at)
      values ('${observation}','4a000000-0000-4000-8000-000000000110','${token}','f2-race','adapter-v1','market','liquidity','AVAILABLE',100,100,2,'USD','{}','{"authority":"f2-race"}',repeat('d',64),now()-interval '1 hour');
    insert into public.radar_work_items(id, work_kind, token_id, request_key, state, method_version, input_version, reserved_analysis_version, pause_generation)
      values
      ('4a000000-0000-4000-8000-000000000201','REANALYSIS','${token}','f2-race-w1','QUEUED','contract-v1','f2-input',1,1),
      ('4a000000-0000-4000-8000-000000000202','REANALYSIS','${token}','f2-race-w2','QUEUED','contract-v1','f2-input',2,1),
      ('4a000000-0000-4000-8000-000000000203','REANALYSIS','${token}','f2-race-w3','QUEUED','contract-v1','f2-input',3,1),
      ('4a000000-0000-4000-8000-000000000204','REANALYSIS','${token}','f2-race-w4','QUEUED','contract-v1','f2-input',4,1);
    insert into public.radar_work_inputs(work_item_id, observation_id)
      select id, '${observation}' from (values
        ('4a000000-0000-4000-8000-000000000201'::uuid), ('4a000000-0000-4000-8000-000000000202'::uuid),
        ('4a000000-0000-4000-8000-000000000203'::uuid), ('4a000000-0000-4000-8000-000000000204'::uuid)) v(id);
    update public.radar_work_items set state='SUCCEEDED', screening_result='PASS', screening_evaluated_at=now(), sealed_at=now(), input_hash=private.radar_input_fingerprint(id);
    insert into public.radar_analyses(id, token_id, version, status, score, deterministic_data, ai_inference, risk_summary,
      analyzed_at, data_as_of, run_type, work_item_id, completed_at, scoring_method_version, methodology_hash, input_hash,
      component_breakdown, coverage, public_eligibility, freshness_policy_version, expires_at)
      select x.id, '${token}', x.version, x.status, x.score, jsonb_build_object('why_on_radar',x.reason), '{}', x.risk,
        now(), now()-interval '5 minutes', 'REANALYSIS', x.work_id, now(), 'contract-v1', repeat(x.hash_char,64), w.input_hash,
        '{}', '{}', true, 'f2-race-freshness', now()+interval '1 day'
      from (values
        ('4a000000-0000-4000-8000-000000000211'::uuid,1,'EARLY',31::numeric,'One','Risk one','a','4a000000-0000-4000-8000-000000000201'::uuid),
        ('4a000000-0000-4000-8000-000000000212'::uuid,2,'TRENDING',32::numeric,'Two','Risk two','b','4a000000-0000-4000-8000-000000000202'::uuid),
        ('4a000000-0000-4000-8000-000000000213'::uuid,3,'TRENDING',33::numeric,'Three','Risk three','c','4a000000-0000-4000-8000-000000000203'::uuid),
        ('4a000000-0000-4000-8000-000000000214'::uuid,4,'HIGH_RISK',34::numeric,'Four','Risk four','d','4a000000-0000-4000-8000-000000000204'::uuid)
      ) x(id,version,status,score,reason,risk,hash_char,work_id)
      join public.radar_work_items w on w.id=x.work_id;
    insert into public.radar_evidence(analysis_id, token_id, evidence_key, classification, origin, category, label, statement,
      numeric_value, numeric_unit, decimal_places, provider, adapter_version, observation_id, source_reference,
      observed_at, received_at, evaluated_at, methodology_version, is_public, public_rank)
      select a.id, '${token}', 'race-evidence-'||a.version, 'VERIFIED_DATA', 'DETERMINISTIC', 'market', 'Race evidence',
        'Bound observation', 100, 'USD', 2, 'f2-race', 'adapter-v1', '${observation}', 'https://example.test/race',
        now()-interval '1 hour', now()-interval '30 minutes', now(), 'contract-v1', true, 1
      from public.radar_analyses a;
    insert into public.radar_reviews(id, analysis_id, token_id) values
      ('4a000000-0000-4000-8000-000000000221','4a000000-0000-4000-8000-000000000211','${token}'),
      ('4a000000-0000-4000-8000-000000000222','4a000000-0000-4000-8000-000000000212','${token}'),
      ('4a000000-0000-4000-8000-000000000223','4a000000-0000-4000-8000-000000000213','${token}'),
      ('4a000000-0000-4000-8000-000000000224','4a000000-0000-4000-8000-000000000214','${token}');
  `);
  for (const review of ["221", "222", "223", "224"]) {
    await sql(db, authenticatedSql(owner, `select public.radar_approve_review('4a000000-0000-4000-8000-000000000${review}',1,'note','disclosure','approve-${review}')`));
  }
  await sql(db, authenticatedSql(reviewer, "select public.radar_publish_review('4a000000-0000-4000-8000-000000000221',2,'publish-221')"));
  pass("baseline approved publication exists");
  const baselinePublicationHash = await sql(db, "select md5(to_jsonb(r)::text) from public.radar_reviews r where id='4a000000-0000-4000-8000-000000000221';");

  let release = await hold(db, "f2-suspension-holder", "select id from public.feature_flags where key='radar_enabled' for update");
  const suspendedPublisher = command(sqlArgs(db), `set application_name='f2-suspension-publisher'; ${authenticatedSql(reviewer, "select public.radar_publish_review('4a000000-0000-4000-8000-000000000222',2,'race-inactive-approver')")}`);
  await waitForLock(db, "f2-suspension-publisher");
  const suspendApprover = sql(db, "update public.profiles set status='SUSPENDED' where id='4a000000-0000-4000-8000-000000000001';");
  await suspendApprover;
  await release();
  const raceA = await suspendedPublisher;
  assert.notEqual(raceA.code, 0, raceA.stderr);
  assert.match(raceA.stderr, /55000/);
  assert.equal(await sql(db, "select md5(to_jsonb(r)::text) from public.radar_reviews r where id='4a000000-0000-4000-8000-000000000221';"), baselinePublicationHash);
  pass("approver suspension committed during a confirmed publication lock wait and was revalidated");
  await sql(db, "update public.profiles set status='ACTIVE' where id='4a000000-0000-4000-8000-000000000001';");

  release = await hold(db, "f2-revision-holder", "select id from public.tokens where id='4a000000-0000-4000-8000-000000000100' for update");
  const stalePublisher = command(sqlArgs(db), `set application_name='f2-revision-publisher'; ${authenticatedSql(reviewer, "select public.radar_publish_review('4a000000-0000-4000-8000-000000000223',2,'race-stale-revision')")}`);
  await waitForLock(db, "f2-revision-publisher");
  const revisionChange = command(sqlArgs(db), authenticatedSql(reviewer, "select public.radar_update_editorial_note('4a000000-0000-4000-8000-000000000223',2,'revision changed','race-note')"));
  const revisionChangeResult = await revisionChange;
  assert.equal(revisionChangeResult.code, 0, revisionChangeResult.stderr);
  await release();
  const stalePublisherResult = await stalePublisher;
  assert.notEqual(stalePublisherResult.code, 0, stalePublisherResult.stderr);
  assert.match(stalePublisherResult.stderr, /40001/);
  pass("review revision committed during a confirmed publication lock wait and stale publish failed");

  release = await hold(db, "f2-pause-holder", "select id from public.tokens where id='4a000000-0000-4000-8000-000000000100' for update");
  const pausedPublisher = command(sqlArgs(db), `set application_name='f2-pause-publisher'; ${authenticatedSql(reviewer, "select public.radar_publish_review('4a000000-0000-4000-8000-000000000224',2,'race-pause-publish')")}`);
  await waitForLock(db, "f2-pause-publisher");
  const pauseMutation = await sql(db, authenticatedSql(owner, "select public.radar_set_emergency_pause(true,1,'race-pause')"));
  assert.equal(pauseMutation, "2");
  await release();
  const raceC = await pausedPublisher;
  assert.notEqual(raceC.code, 0, raceC.stderr);
  assert.match(raceC.stderr, /55000/);
  pass("pause generation changed during a confirmed publication lock wait and stale publication failed");
  await sql(db, authenticatedSql(owner, "select public.radar_set_emergency_pause(false,2,'race-resume')"));

  const replacementRace = await Promise.all([
    command(sqlArgs(db), authenticatedSql(reviewer, "select public.radar_publish_review('4a000000-0000-4000-8000-000000000223',3,'race-replacement-3')")),
    command(sqlArgs(db), authenticatedSql(reviewer, "select public.radar_publish_review('4a000000-0000-4000-8000-000000000224',2,'race-replacement-4')")),
  ]);
  assert.ok(replacementRace.some((result) => result.code === 0), replacementRace.map((result) => result.stderr).join("\n"));
  assert.equal((await sql(db, "select count(*) from public.radar_reviews where token_id='4a000000-0000-4000-8000-000000000100' and state='PUBLISHED';")), "1");
  assert.equal((await sql(db, "select analysis_id from public.radar_reviews where token_id='4a000000-0000-4000-8000-000000000100' and state='PUBLISHED';")), "4a000000-0000-4000-8000-000000000214");
  pass("replacement publication race leaves one current publication at the highest version");
}

try { await main(); console.log("Radar F2 publication concurrency checks: " + checks + "/" + checks + " PASS"); }
catch (error) { console.error(error.message); process.exitCode = 1; }
finally {
  for (const db of created) {
    try { await sql("postgres", "drop database " + db + ";"); }
    catch (error) { console.error("Scratch cleanup blocked for " + db + ": " + error.message); process.exitCode = 1; }
  }
  if (created.size) console.log("Removed only this run's disposable Radar F2 validation database.");
}
