// LOCAL ONLY. Gate 19C-F3 uses separate psql sessions and real row-lock waits.
import assert from "node:assert/strict";
import { spawn } from "node:child_process";
import { randomUUID } from "node:crypto";
import { readFile, readdir } from "node:fs/promises";

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
function pass(label) { checks += 1; console.log("PASS: " + label); }
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
function serviceSql(statement) {
  return `begin; set local role service_role; ${statement}; commit;`;
}

async function main() {
  const context = await command(["context", "inspect", "--format", "{{.Endpoints.docker.Host}}"]);
  assert.equal(context.code, 0, context.stderr);
  assert.ok(context.stdout.trim().startsWith("unix://"), "Refusing nonlocal Docker context");
  const dump = await command(["exec", container, "pg_dump", "-U", "postgres", "-d", "postgres",
    "--schema-only", "--no-owner", "--no-privileges", "--schema=auth", "--schema=extensions"]);
  assert.equal(dump.code, 0, dump.stderr);
  const migrationsDir = new URL("../../migrations/", import.meta.url);
  const migrationFiles = (await readdir(migrationsDir)).filter((file) => file.endsWith(".sql")).sort();
  const migrations = await Promise.all(migrationFiles.map((file) => readFile(new URL(file, migrationsDir), "utf8")));
  assert.ok(migrations.length >= 20, "F3 harness requires the established migration baseline");
  const db = "next100xgems_gate19cf3_" + randomUUID().replaceAll("-", "").slice(0, 12);
  await sql("postgres", "create database " + db + ";");
  created.add(db);
  await sql(db, dump.stdout);
  for (const migration of migrations) await sql(db, migration);
  pass("F3 scratch database replays the complete real migration set");

  const owner = "4f000000-0000-4000-8000-000000000001";
  const reviewer = "4f000000-0000-4000-8000-000000000002";
  const token = "4f000000-0000-4000-8000-000000000100";
  const observation = "4f000000-0000-4000-8000-000000000101";
  await sql(db, `
    insert into auth.users(id) values ('${owner}'), ('${reviewer}');
    insert into public.profiles(id, display_name, status) values
      ('${owner}', 'F3 race owner', 'ACTIVE'), ('${reviewer}', 'F3 race reviewer', 'ACTIVE');
    insert into public.user_roles(user_id, role_id)
      select '${owner}', id from public.roles where key='owner';
    insert into public.user_roles(user_id, role_id)
      select '${reviewer}', id from public.roles where key='radar_reviewer';
    insert into public.radar_methodology_versions(methodology_version, state, is_test_only, content_hash, approved_at)
      values ('f3-race-method', 'APPROVED', true, repeat('a',64), now());
    insert into public.radar_freshness_policies(freshness_policy_version, state, is_test_only, content_hash, approved_at)
      values ('f3-race-policy', 'APPROVED', true, repeat('b',64), now());
    insert into public.tokens(id, chain, contract_address, symbol, name)
      values ('${token}', 'eip155:1', '0x4444444444444444444444444444444444444444', 'RACEF3', 'F3 race token');
    update public.feature_flags set enabled=case key when 'radar_enabled' then true when 'maintenance_mode' then false when 'radar_emergency_paused' then false else enabled end,
      configuration=case when key='radar_emergency_paused' then '{"generation":1}'::jsonb else configuration end
      where key in ('radar_enabled','maintenance_mode','radar_emergency_paused');
    insert into public.radar_events(id,event_key,event_type,token_id,source_provider,source_event_id,payload_hash,context,observed_at)
      values ('4f000000-0000-4000-8000-000000000110','f3-race-event','DISCOVERY','${token}','f3-race','source',repeat('c',64),'{}',now()-interval '1 hour');
    insert into public.radar_observations(id,event_id,token_id,provider,adapter_version,capability,metric_key,data_state,normalized_value,raw_integer_value,decimal_places,unit,context,provenance,content_hash,observed_at)
      values ('${observation}','4f000000-0000-4000-8000-000000000110','${token}','f3-race','adapter-v1','market','liquidity','AVAILABLE',100,100,2,'USD','{}','{"authority":"f3-race"}',repeat('d',64),now()-interval '1 hour');
    insert into public.radar_work_items(id,work_kind,token_id,request_key,state,method_version,input_version,reserved_analysis_version,pause_generation)
      select ('4f000000-0000-4000-8000-00000000020' || n)::uuid,'REANALYSIS','${token}','f3-race-w'||n,'QUEUED','f3-race-method','f3-input',n,1
      from generate_series(1,7) n;
    insert into public.radar_work_items(id,work_kind,token_id,request_key,state,method_version,input_version,reserved_analysis_version,pause_generation)
      values ('4f000000-0000-4000-8000-000000000299','SCREENING','${token}','f3-lease-work','QUEUED','f3-race-method','f3-input',99,1);
    update public.radar_work_items set sealed_at=now(), input_hash=private.radar_input_fingerprint(id) where id='4f000000-0000-4000-8000-000000000299';
    insert into public.radar_work_inputs(work_item_id,observation_id)
      select ('4f000000-0000-4000-8000-00000000020' || n)::uuid,'${observation}' from generate_series(1,7) n;
    update public.radar_work_items set state='SUCCEEDED',screening_result='PASS',screening_evaluated_at=now(),sealed_at=now(),input_hash=private.radar_input_fingerprint(id)
      where request_key like 'f3-race-w%';
    insert into public.radar_analyses(id,token_id,version,status,score,deterministic_data,ai_inference,risk_summary,analyzed_at,data_as_of,run_type,work_item_id,completed_at,scoring_method_version,methodology_hash,input_hash,component_breakdown,coverage,public_eligibility,freshness_policy_version,expires_at)
      select ('4f000000-0000-4000-8000-00000000021' || n)::uuid,'${token}',n,'TRENDING',40+n,jsonb_build_object('why_on_radar','Race '||n),'{}','F3 race risk',now(),now()-interval '5 minutes','REANALYSIS',w.id,now()-interval '1 second','f3-race-method',repeat('e',64),w.input_hash,'{}','{}',true,'f3-race-policy',case when n=5 then now()+interval '20 seconds' else now()+interval '1 day' end
      from generate_series(1,7) n join public.radar_work_items w on w.request_key='f3-race-w'||n;
    insert into public.radar_evidence(analysis_id,token_id,evidence_key,classification,origin,category,label,statement,numeric_value,numeric_unit,decimal_places,provider,adapter_version,observation_id,source_reference,observed_at,received_at,evaluated_at,methodology_version,is_public,public_rank)
      select a.id,'${token}','f3-race-evidence-'||a.version,'VERIFIED_DATA','DETERMINISTIC','market','Race evidence','Bound observation',100,'USD',2,'f3-race','adapter-v1','${observation}','https://example.test/f3-race',now()-interval '1 hour',now()-interval '30 minutes',now(),'f3-race-method',true,1 from public.radar_analyses a;
    update public.radar_work_items w set result_analysis_id=a.id
      from public.radar_analyses a where w.id=a.work_item_id;
    insert into public.radar_reviews(id,analysis_id,token_id)
      select ('4f000000-0000-4000-8000-00000000022' || n)::uuid,('4f000000-0000-4000-8000-00000000021' || n)::uuid,'${token}' from generate_series(1,7) n;
  `);
  for (let n = 1; n <= 5; n += 1) {
    await sql(db, authenticatedSql(reviewer, `select public.radar_approve_review('4f000000-0000-4000-8000-00000000022${n}',1,'note','disclosure','f3-race-approve-${n}')`));
  }
  await sql(db, authenticatedSql(owner, "select public.radar_publish_review('4f000000-0000-4000-8000-000000000221',2,'f3-race-baseline-publication')"));
  const baselinePublicationHash = await sql(db, "select md5(to_jsonb(r)::text) from public.radar_reviews r where id='4f000000-0000-4000-8000-000000000221';");

  await sql(db, `update public.radar_work_items set state='RUNNING',lease_owner='lease-worker',lease_token='4f000000-0000-4000-8000-000000000299',lease_expires_at=clock_timestamp()+interval '3 seconds',lease_generation=1 where id='4f000000-0000-4000-8000-000000000299';`);
  const leaseHash = await sql(db, "select input_hash from public.radar_work_items where id='4f000000-0000-4000-8000-000000000299';");
  const leaseBefore = await sql(db, "select md5(to_jsonb(w)::text) from public.radar_work_items w where id='4f000000-0000-4000-8000-000000000299';");
  const releaseLease = await hold(db, "f3-lease-holder", "select id from public.radar_work_items where id='4f000000-0000-4000-8000-000000000299' for update");
  const staleCompletion = command(sqlArgs(db), `begin; set application_name='f3-lease-completion'; set local role service_role; select public.radar_system_complete_screening('4f000000-0000-4000-8000-000000000299','lease-worker','4f000000-0000-4000-8000-000000000299',1,'PASS','[]','${leaseHash}',clock_timestamp()); commit;`);
  await waitForLock(db, "f3-lease-completion");
  assert.equal(await sql(db, "select (lease_expires_at > clock_timestamp())::text from public.radar_work_items where id='4f000000-0000-4000-8000-000000000299';"), "true");
  await sql(db, "select pg_sleep(greatest(0, extract(epoch from lease_expires_at-clock_timestamp()))::double precision + 0.25) from public.radar_work_items where id='4f000000-0000-4000-8000-000000000299';");
  await releaseLease();
  const leaseRace = await staleCompletion;
  assert.notEqual(leaseRace.code, 0, leaseRace.stderr);
  assert.match(leaseRace.stderr, /40001/);
  assert.equal(await sql(db, "select md5(to_jsonb(w)::text) from public.radar_work_items w where id='4f000000-0000-4000-8000-000000000299';"), leaseBefore);
  pass("lease expiry during a real row-lock wait rejects screening completion");

  let release = await hold(db, "f3-publisher-holder", "select id from public.tokens where id='4f000000-0000-4000-8000-000000000100' for update");
  const publisherRevoked = command(sqlArgs(db), `set application_name='f3-publisher-revocation'; ${authenticatedSql(owner, "select public.radar_publish_review('4f000000-0000-4000-8000-000000000222',2,'f3-race-publisher-revoked')")}`);
  await waitForLock(db, "f3-publisher-revocation");
  await sql(db, `delete from public.user_roles where user_id='${owner}';`);
  await release();
  const raceB = await publisherRevoked;
  assert.notEqual(raceB.code, 0, raceB.stderr);
  assert.match(raceB.stderr, /permission denied|42501/);
  await sql(db, `insert into public.user_roles(user_id,role_id) select '${owner}',id from public.roles where key='owner';`);
  assert.equal(await sql(db, "select count(*) from public.radar_reviews where id='4f000000-0000-4000-8000-000000000221' and state='PUBLISHED';"), "1");
  pass("publisher authorization was revoked during a confirmed publication lock wait and was revalidated");

  release = await hold(db, "f3-approver-holder", "select id from public.tokens where id='4f000000-0000-4000-8000-000000000100' for update");
  const conflictedApprover = command(sqlArgs(db), `set application_name='f3-approver-conflict'; ${authenticatedSql(owner, "select public.radar_publish_review('4f000000-0000-4000-8000-000000000223',2,'f3-race-approver-conflict')")}`);
  await waitForLock(db, "f3-approver-conflict");
  await sql(db, `insert into public.user_roles(user_id,role_id) select '${reviewer}',id from public.roles where key='ad_manager';`);
  await release();
  const raceC = await conflictedApprover;
  assert.notEqual(raceC.code, 0, raceC.stderr);
  assert.match(raceC.stderr, /55000/);
  await sql(db, `delete from public.user_roles where user_id='${reviewer}' and role_id=(select id from public.roles where key='ad_manager');`);
  assert.equal(await sql(db, "select count(*) from public.radar_reviews where id='4f000000-0000-4000-8000-000000000223' and state='PUBLISHED';"), "0");
  pass("approver effective-role conflict was introduced during a confirmed publication lock wait and rejected");

  release = await hold(db, "f3-pause-holder", "select id from public.tokens where id='4f000000-0000-4000-8000-000000000100' for update");
  const pausedPublisher = command(sqlArgs(db), `set application_name='f3-pause-publisher'; ${authenticatedSql(owner, "select public.radar_publish_review('4f000000-0000-4000-8000-000000000224',2,'f3-race-pause')")}`);
  await waitForLock(db, "f3-pause-publisher");
  const pauseMutation = command(sqlArgs(db), authenticatedSql(owner, "select public.radar_set_emergency_pause(true,1,'f3-race-pause-toggle')"));
  const pauseResult = await pauseMutation;
  assert.equal(pauseResult.code, 0, pauseResult.stderr);
  await release();
  const raceD = await pausedPublisher;
  assert.notEqual(raceD.code, 0, raceD.stderr);
  assert.match(raceD.stderr, /55000/);
  await sql(db, authenticatedSql(owner, "select public.radar_set_emergency_pause(false,2,'f3-race-pause-resume')"));
  assert.equal(await sql(db, "select count(*) from public.radar_reviews where id='4f000000-0000-4000-8000-000000000224' and state='PUBLISHED';"), "0");
  pass("emergency pause changed after a confirmed publication lock wait and publication rejected");

  release = await hold(db, "f3-expiry-holder", "select id from public.tokens where id='4f000000-0000-4000-8000-000000000100' for update");
  const expiredPublisher = command(sqlArgs(db), `set application_name='f3-expiry-publisher'; ${authenticatedSql(owner, "select public.radar_publish_review('4f000000-0000-4000-8000-000000000225',2,'f3-race-expired')")}`);
  await waitForLock(db, "f3-expiry-publisher");
  assert.equal(await sql(db, "select (expires_at > clock_timestamp())::text from public.radar_analyses where id='4f000000-0000-4000-8000-000000000215';"), "true", "expiry candidate must still be valid at confirmed wait");
  await sql(db, "select pg_sleep(greatest(0, extract(epoch from expires_at-clock_timestamp()))::double precision + 0.25) from public.radar_analyses where id='4f000000-0000-4000-8000-000000000215';");
  await release();
  const raceE = await expiredPublisher;
  assert.notEqual(raceE.code, 0, raceE.stderr);
  assert.match(raceE.stderr, /55000/);
  assert.equal(await sql(db, "select md5(to_jsonb(r)::text) from public.radar_reviews r where id='4f000000-0000-4000-8000-000000000221';"), baselinePublicationHash);
  assert.equal(await sql(db, "select state from public.radar_reviews where id='4f000000-0000-4000-8000-000000000225';"), "APPROVED");
  assert.equal(await sql(db, "select publication_snapshot from public.radar_reviews where id='4f000000-0000-4000-8000-000000000225';"), "{}");
  pass("publication expiry occurred only after a confirmed lock wait and the prior publication stayed unchanged");

  await sql(db, "update public.radar_work_items set pause_generation=(select (configuration->>'generation')::bigint from public.feature_flags where key='radar_emergency_paused') where id in ('4f000000-0000-4000-8000-000000000206','4f000000-0000-4000-8000-000000000207');");
  const analysisLock = command(sqlArgs(db), "begin; select id from public.radar_analyses where id='4f000000-0000-4000-8000-000000000216' for update; select pg_sleep(1.0); commit;");
  await delay(100);
  const approving = command(sqlArgs(db), `set application_name='f3-approval-freeze'; ${authenticatedSql(reviewer, "select public.radar_approve_review('4f000000-0000-4000-8000-000000000226',1,'note','disclosure','f3-race-approval-append')")}`);
  await waitForLock(db, "f3-approval-freeze");
  const analysisLockResult = await analysisLock;
  assert.equal(analysisLockResult.code, 0, analysisLockResult.stderr);
  const approvalResult = await approving;
  assert.equal(approvalResult.code, 0, approvalResult.stderr);
  const approvalAppendGeneration = await sql(db, "select lease_generation from public.radar_work_items where id='4f000000-0000-4000-8000-000000000206';");
  const appending = await command(sqlArgs(db), serviceSql(`select public.radar_system_append_evidence('4f000000-0000-4000-8000-000000000216','4f000000-0000-4000-8000-000000000100','contended-append','STRONG_SIGNAL','DETERMINISTIC','market','Contended','Bound observation',100,'USD',2,null,null,'f3-race','adapter-v1','4f000000-0000-4000-8000-000000000101','https://example.test/contended',now(),now(),now(),'f3-race-method',false,9,${approvalAppendGeneration})`));
  assert.notEqual(appending.code, 0, appending.stderr);
  assert.match(appending.stderr, /55000/);
  const freezeCount = await sql(db, "select count(*) from public.radar_evidence_freezes where analysis_id='4f000000-0000-4000-8000-000000000216';");
  assert.equal(freezeCount, "1");
  assert.equal(await sql(db, "select count(*) from public.radar_evidence where analysis_id='4f000000-0000-4000-8000-000000000216' and evidence_key='contended-append';"), "0");
  pass("approval-first evidence freeze after an explicit lock wait rejects the otherwise-valid later append");

  const appendFirstGeneration = await sql(db, "select lease_generation from public.radar_work_items where id='4f000000-0000-4000-8000-000000000207';");
  const appendFirst = await sql(db, serviceSql(`select public.radar_system_append_evidence('4f000000-0000-4000-8000-000000000217','4f000000-0000-4000-8000-000000000100','append-first','VERIFIED_DATA','DETERMINISTIC','market','Append-first evidence','Bound observation',100,'USD',2,null,null,'f3-race','adapter-v1','4f000000-0000-4000-8000-000000000101','https://example.test/append-first',now(),now(),now(),'f3-race-method',true,2,${appendFirstGeneration})`));
  assert.notEqual(appendFirst, "", "append-first evidence must commit before approval");
  await sql(db, authenticatedSql(reviewer, "select public.radar_approve_review('4f000000-0000-4000-8000-000000000227',1,'note','disclosure','f3-race-approve-7')"));
  assert.equal(await sql(db, "select count(*) from public.radar_reviews r, jsonb_array_elements(r.public_evidence_snapshot) item where r.id='4f000000-0000-4000-8000-000000000227' and item->>'label'='Append-first evidence' and item->>'source_reference'='https://example.test/append-first';"), "1");
  pass("append-first evidence commits with the current fence and is included in the later approval snapshot");

  const replacementRace = await Promise.all([
    command(sqlArgs(db), authenticatedSql(owner, "select public.radar_publish_review('4f000000-0000-4000-8000-000000000226',2,'f3-race-replacement-6')")),
    command(sqlArgs(db), authenticatedSql(owner, "select public.radar_publish_review('4f000000-0000-4000-8000-000000000227',2,'f3-race-replacement-7')")),
  ]);
  assert.ok(replacementRace.some((result) => result.code === 0), replacementRace.map((result) => result.stderr).join("\n"));
  assert.equal(await sql(db, "select count(*) from public.radar_reviews where token_id='4f000000-0000-4000-8000-000000000100' and state='PUBLISHED';"), "1");
  assert.equal(await sql(db, "select analysis_id from public.radar_reviews where token_id='4f000000-0000-4000-8000-000000000100' and state='PUBLISHED';"), "4f000000-0000-4000-8000-000000000217");
  pass("replacement publication race leaves exactly one current highest-version publication");
}

try { await main(); console.log("Radar F3 lock-wait concurrency checks: " + checks + "/" + checks + " PASS"); }
catch (error) { console.error(error.stack || error.message); process.exitCode = 1; }
finally {
  for (const db of created) {
    try { await sql("postgres", "drop database " + db + ";"); }
    catch (error) { console.error("Scratch cleanup blocked for " + db + ": " + error.message); process.exitCode = 1; }
  }
  if (created.size) console.log("Removed only this run's disposable Radar F3 validation database.");
}
