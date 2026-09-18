// LOCAL ONLY. Replays F2 data, applies F3/F4 in a disposable database, and
// checks the upgrade boundary plus corrected lock-wait invariants.
import assert from "node:assert/strict";
import { spawn } from "node:child_process";
import { randomUUID } from "node:crypto";
import { readFile, readdir } from "node:fs/promises";

const container = "supabase_db_next100xgems-web_2";
const created = new Set();
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
async function sql(db, statement, expectedCode = 0) {
  const result = await command(sqlArgs(db), statement);
  assert.equal(result.code, expectedCode, result.stderr);
  return result.stdout.trim();
}
async function waitForLock(db, applicationName) {
  for (let i = 0; i < 120; i += 1) {
    const waiting = await sql(db, `select count(*) from pg_stat_activity
      where datname=current_database() and application_name='${applicationName}'
        and wait_event_type='Lock';`);
    if (waiting === "1") return;
    await new Promise((resolve) => setTimeout(resolve, 25));
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
  for (let i = 0; i < 120 && !stdout.includes("READY"); i += 1) {
    await new Promise((resolve) => setTimeout(resolve, 25));
  }
  assert.ok(stdout.includes("READY"), stderr);
  return async (commit = false) => {
    child.stdin.end(`${commit ? "commit" : "rollback"};\n`);
    const result = await done;
    assert.equal(result.code, 0, result.stderr);
  };
}
function authenticatedSql(subject, statement) {
  return `begin; set local request.jwt.claims = '{"sub":"${subject}","role":"authenticated"}';
    set local request.jwt.claim.sub = '${subject}'; set local role authenticated; ${statement}; commit;`;
}
function uuid(prefix, n) { return `${prefix}-0000-0000-0000-000000000${String(n).padStart(3, "0")}`; }

async function main() {
  const context = await command(["context", "inspect", "--format", "{{.Endpoints.docker.Host}}"]);
  assert.equal(context.code, 0, context.stderr);
  assert.ok(context.stdout.trim().startsWith("unix://"), "refusing nonlocal Docker context");
  const dump = await command(["exec", container, "pg_dump", "-U", "postgres", "-d", "postgres",
    "--schema-only", "--no-owner", "--no-privileges", "--schema=auth", "--schema=extensions"]);
  assert.equal(dump.code, 0, dump.stderr);
  const migrationsDir = new URL("../../migrations/", import.meta.url);
  const files = (await readdir(migrationsDir)).filter((file) => file.endsWith(".sql")).sort();
  assert.equal(files.length, 20, "F4 migration inventory must contain twenty migrations");
  const migrations = await Promise.all(files.map((file) => readFile(new URL(file, migrationsDir), "utf8")));
  const db = `next100xgems_gate19cf4_${randomUUID().replaceAll("-", "").slice(0, 12)}`;
  await sql("postgres", `create database ${db};`);
  created.add(db);
  await sql(db, dump.stdout);

  // Apply only through F2. The two final files are F3 and F4.
  for (const migration of migrations.slice(0, -2)) await sql(db, migration);

  const owner = "4f000000-0000-0000-0000-000000000001";
  const reviewer = "4f000000-0000-0000-0000-000000000002";
  const source = "4f000000-0000-0000-0000-000000000111";
  const event = "4f000000-0000-0000-0000-000000000110";
  const base = `
    insert into auth.users(id) values ('${owner}'), ('${reviewer}');
    insert into public.profiles(id,display_name,status) values
      ('${owner}','F4 owner','ACTIVE'),('${reviewer}','F4 reviewer','ACTIVE');
    insert into public.user_roles(user_id,role_id) select '${owner}',id from public.roles where key='owner';
    insert into public.user_roles(user_id,role_id) select '${reviewer}',id from public.roles where key='radar_reviewer';
    insert into public.radar_methodology_versions(methodology_version,state,is_test_only,content_hash,approved_at)
      values ('f4-method','APPROVED',true,repeat('a',64),now());
    insert into public.radar_freshness_policies(freshness_policy_version,state,is_test_only,content_hash,approved_at)
      values ('f4-policy','APPROVED',true,repeat('b',64),now());
    update public.feature_flags set enabled=case key when 'radar_enabled' then true when 'maintenance_mode' then false when 'radar_emergency_paused' then false else enabled end,
      configuration=case when key='radar_emergency_paused' then '{"generation":1}'::jsonb else configuration end
      where key in ('radar_enabled','maintenance_mode','radar_emergency_paused');
    insert into public.tokens(id,chain,contract_address,symbol,name)
      values ('${uuid("4f000000",100)}','eip155:1','0x${"0".repeat(39)}1','F4100','F4 token 100');
    insert into public.radar_events(id,event_key,event_type,token_id,source_provider,source_event_id,payload_hash,context,observed_at)
      values ('${event}','f4-event','DISCOVERY','${uuid("4f000000",100)}','f4-provider','source',repeat('c',64),'{}',now()-interval '1 hour');
    insert into public.radar_observations(id,event_id,token_id,provider,adapter_version,capability,metric_key,data_state,normalized_value,raw_integer_value,decimal_places,unit,context,provenance,content_hash,observed_at)
      values ('${source}','${event}','${uuid("4f000000",100)}','f4-provider','adapter-v1','market','liquidity','AVAILABLE',100,100,2,'USD','{}','{"authority":"f4"}',repeat('d',64),now()-interval '1 hour');
  `;
  await sql(db, base);
  const seededTokens = new Set([100]);
  for (const [tokenNo, version, why] of [
    [100, 1, "Legacy valid string"], [101, 1, '{"private_marker":"audit-only"}'],
    [102, 1, '{"private_marker":"published-audit-only"}'], [103, 1, "Race baseline"],
    [103, 2, "Race candidate"], [103, 3, "Race expiry candidate"]
  ]) {
    const token = uuid("4f000000", tokenNo);
    if (tokenNo !== 100) await sql(db, `insert into public.tokens(id,chain,contract_address,symbol,name) values ('${token}','eip155:1','0x${String(tokenNo).padStart(40,"0")}','F4${tokenNo}','F4 token ${tokenNo}') on conflict do nothing;`);
    const work = uuid("4f000100", tokenNo + version);
    const analysis = uuid("4f000200", tokenNo + version);
    const review = uuid("4f000300", tokenNo + version);
    const observationId = tokenNo === 100 ? source : uuid("4f000400", tokenNo);
    const eventId = tokenNo === 100 ? event : uuid("4f000500", tokenNo);
    const json = why.startsWith("{")
      ? `jsonb_build_object('why_on_radar','${why.replaceAll("'", "''")}'::jsonb)`
      : `jsonb_build_object('why_on_radar','${why}')`;
    if (!seededTokens.has(tokenNo)) {
      seededTokens.add(tokenNo);
      await sql(db, `
      insert into public.radar_events(id,event_key,event_type,token_id,source_provider,source_event_id,payload_hash,context,observed_at)
        values ('${eventId}','f4-event-${tokenNo}','DISCOVERY','${token}','f4-provider','source-${tokenNo}',repeat('c',64),'{}',now()-interval '1 hour');
      insert into public.radar_observations(id,event_id,token_id,provider,adapter_version,capability,metric_key,data_state,normalized_value,raw_integer_value,decimal_places,unit,context,provenance,content_hash,observed_at)
        values ('${observationId}','${eventId}','${token}','f4-provider','adapter-v1','market','liquidity','AVAILABLE',100,100,2,'USD','{}','{"authority":"f4"}',repeat('d',64),now()-interval '1 hour');
      `);
    }
    await sql(db, `
      insert into public.radar_work_items(id,work_kind,token_id,request_key,state,method_version,input_version,reserved_analysis_version,pause_generation)
        values ('${work}','REANALYSIS','${token}','f4-work-${tokenNo}-${version}','QUEUED','f4-method','f4-input',${version},1);
      insert into public.radar_work_inputs(work_item_id,observation_id) values ('${work}','${observationId}');
      update public.radar_work_items set screening_result='PASS',screening_evaluated_at=now(),sealed_at=now(),input_hash=private.radar_input_fingerprint(id) where id='${work}';
      insert into public.radar_analyses(id,token_id,version,status,score,deterministic_data,ai_inference,risk_summary,analyzed_at,data_as_of,run_type,work_item_id,completed_at,scoring_method_version,methodology_hash,input_hash,component_breakdown,coverage,public_eligibility,freshness_policy_version,expires_at)
        values ('${analysis}','${token}',${version},'TRENDING',42,${json},'{}','F4 risk',now(),now()-interval '5 minutes','REANALYSIS','${work}',now(),'f4-method',repeat('e',64),(select input_hash from public.radar_work_items where id='${work}'),'{}','{}',true,'f4-policy',case when ${version}=3 then now()+interval '20 seconds' else now()+interval '1 day' end);
      update public.radar_work_items set result_analysis_id='${analysis}' where id='${work}';
      insert into public.radar_evidence(analysis_id,token_id,evidence_key,classification,origin,category,label,statement,numeric_value,numeric_unit,provider,adapter_version,observation_id,source_reference,observed_at,received_at,evaluated_at,methodology_version,is_public,public_rank)
        values ('${analysis}','${token}','f4-evidence-${tokenNo}-${version}','STRONG_SIGNAL','DETERMINISTIC','market','F4 evidence','Bound observation',100,'USD','f4-provider','adapter-v1',null,'https://example.test/f4',now()-interval '1 hour',now()-interval '30 minutes',now(),'f4-method',true,1);
      insert into public.radar_reviews(id,analysis_id,token_id) values ('${review}','${analysis}','${token}');
    `);
  }
  // Pre-F3 approval/publication creation. These calls use the F2 functions.
  await sql(db, authenticatedSql(reviewer, `select public.radar_approve_review('${uuid("4f000300",103)}',1,'note','disclosure','f4-unsafe-published-approve')`));
  await sql(db, authenticatedSql(reviewer, `select public.radar_publish_review('${uuid("4f000300",103)}',2,'f4-unsafe-publish')`));
  await sql(db, authenticatedSql(reviewer, `select public.radar_approve_review('${uuid("4f000300",101)}',1,'note','disclosure','f4-valid-approve')`));
  await sql(db, authenticatedSql(reviewer, `select public.radar_publish_review('${uuid("4f000300",101)}',2,'f4-valid-publish')`));
  await sql(db, authenticatedSql(reviewer, `select public.radar_approve_review('${uuid("4f000300",102)}',1,'note','disclosure','f4-unsafe-pending')`));
  await sql(db, authenticatedSql(reviewer, `select public.radar_approve_review('${uuid("4f000300",104)}',1,'note','disclosure','f4-race-approve-1')`));
  await sql(db, authenticatedSql(reviewer, `select public.radar_approve_review('${uuid("4f000300",105)}',1,'note','disclosure','f4-race-approve-2')`));
  await sql(db, authenticatedSql(reviewer, `select public.radar_approve_review('${uuid("4f000300",106)}',1,'note','disclosure','f4-race-approve-3')`));
  await sql(db, authenticatedSql(reviewer, `select public.radar_publish_review('${uuid("4f000300",104)}',2,'f4-race-baseline')`));

  await sql(db, migrations[18]);
  await sql(db, migrations[19]);
  assert.equal(await sql(db, `select count(*) from public.radar_reviews where id='${uuid("4f000300",103)}' and state='PUBLISHED';`), "1");
  assert.equal(await sql(db, `select count(*) from public.radar_reviews where id='${uuid("4f000300",102)}' and state='APPROVED';`), "1");
  assert.equal(await sql(db, `begin; set local role anon; select count(*) from public.get_public_radar_detail('${uuid("4f000000",102)}'); rollback;`), "0", "unsafe published detail must be hidden");
  assert.equal(await sql(db, `begin; set local role anon; select count(*) from public.get_public_radar_detail('${uuid("4f000000",100)}'); rollback;`), "1", "valid legacy detail must remain visible");
  const unsafe = await command(sqlArgs(db), authenticatedSql(owner, `select public.radar_publish_review('${uuid("4f000300",102)}',2,'f4-unsafe-after-upgrade')`));
  assert.notEqual(unsafe.code, 0); assert.match(unsafe.stderr, /55000/);
  const priorPublicationHash = await sql(db, `select md5(to_jsonb(r)::text) from public.radar_reviews r where id='${uuid("4f000300",104)}';`);
  console.log("F4 upgrade: unsafe approval rejected, unsafe publication hidden, valid legacy publication visible");

  // Publisher revocation, approver conflict, expiry and pause all occur after
  // the publication session is confirmed waiting on the current publication
  // row. This is the late mutable lock F4 moved ahead of final validation.
  const publicationLock = `select id from public.radar_reviews where id='${uuid("4f000300",104)}' for update`;
  let release = await hold(db, "f4-current-publisher", publicationLock);
  let pending = command(sqlArgs(db), `set application_name='f4-publisher-call'; ${authenticatedSql(owner, `select public.radar_publish_review('${uuid("4f000300",105)}',2,'f4-publisher-revoked')`)}`);
  await waitForLock(db, "f4-publisher-call");
  await sql(db, `delete from public.user_roles where user_id='${owner}';`);
  await release();
  let result = await pending; assert.notEqual(result.code, 0); assert.match(result.stderr, /42501|55000/);
  await sql(db, `insert into public.user_roles(user_id,role_id) select '${owner}',id from public.roles where key='owner';`);

  release = await hold(db, "f4-current-approver", publicationLock);
  pending = command(sqlArgs(db), `set application_name='f4-approver-call'; ${authenticatedSql(owner, `select public.radar_publish_review('${uuid("4f000300",105)}',2,'f4-approver-conflict')`)}`);
  await waitForLock(db, "f4-approver-call");
  await sql(db, `insert into public.user_roles(user_id,role_id) select '${reviewer}',id from public.roles where key='ad_manager';`);
  await release();
  result = await pending; assert.notEqual(result.code, 0); assert.match(result.stderr, /55000/);
  await sql(db, `delete from public.user_roles where user_id='${reviewer}' and role_id=(select id from public.roles where key='ad_manager');`);

  release = await hold(db, "f4-current-pause", publicationLock);
  pending = command(sqlArgs(db), `set application_name='f4-pause-call'; ${authenticatedSql(owner, `select public.radar_publish_review('${uuid("4f000300",105)}',2,'f4-pause-race')`)}`);
  await waitForLock(db, "f4-pause-call");
  await sql(db, authenticatedSql(owner, "select public.radar_set_emergency_pause(true,1,'f4-pause-during-wait')"));
  await release();
  result = await pending; assert.notEqual(result.code, 0); assert.match(result.stderr, /55000/);
  await sql(db, authenticatedSql(owner, "select public.radar_set_emergency_pause(false,2,'f4-pause-resume')"));

  assert.equal(await sql(db, `select (expires_at > clock_timestamp())::text from public.radar_analyses where id='${uuid("4f000200",106)}';`), "true", "expiry candidate must be valid before lock wait");
  release = await hold(db, "f4-current-expiry", publicationLock);
  pending = command(sqlArgs(db), `set application_name='f4-expiry-call'; ${authenticatedSql(owner, `select public.radar_publish_review('${uuid("4f000300",106)}',2,'f4-expiry-race')`)}`);
  await waitForLock(db, "f4-expiry-call");
  assert.equal(await sql(db, `select (expires_at > clock_timestamp())::text from public.radar_analyses where id='${uuid("4f000200",106)}';`), "true", "expiry candidate must remain valid when publication is confirmed blocked");
  await sql(db, `select pg_sleep(greatest(0, extract(epoch from expires_at-clock_timestamp()))::double precision + 0.25) from public.radar_analyses where id='${uuid("4f000200",106)}';`);
  await release();
  result = await pending; assert.notEqual(result.code, 0); assert.match(result.stderr, /55000/);

  const prior = await sql(db, `select state from public.radar_reviews where id='${uuid("4f000300",104)}';`);
  assert.equal(prior, "PUBLISHED");
  assert.equal(await sql(db, `select md5(to_jsonb(r)::text) from public.radar_reviews r where id='${uuid("4f000300",104)}';`), priorPublicationHash, "expired candidate must not alter the complete current publication row");
  assert.equal(await sql(db, `select state from public.radar_reviews where id='${uuid("4f000300",106)}';`), "APPROVED");
  assert.equal(await sql(db, `select publication_snapshot from public.radar_reviews where id='${uuid("4f000300",106)}';`), "{}");
  assert.equal(await sql(db, `select count(*) from public.radar_reviews where token_id='${uuid("4f000000",103)}' and state='PUBLISHED';`), "1");
  console.log("F4 publication races: publisher revocation, approver conflict and pause rejected after real waits; current publication preserved");

  // The lease worker must lock its authoritative work row before checking
  // expiry. Each race has a separate valid, sealed fixture and crosses the
  // deadline only after the worker is confirmed blocked on that row.
  const renewWork = uuid("4f000600", 500);
  const renewToken = "4f000600-0000-0000-0000-000000000501";
  const failWork = uuid("4f000600", 502);
  const failToken = "4f000600-0000-0000-0000-000000000503";
  await sql(db, `
    insert into public.radar_work_items(id,work_kind,token_id,request_key,state,method_version,input_version,reserved_analysis_version,pause_generation)
      values ('${renewWork}','SCREENING','${uuid("4f000000",100)}','f4-renew-work','QUEUED','f4-method','f4-input',500,
        (select (configuration->>'generation')::bigint from public.feature_flags where key='radar_emergency_paused'));
    insert into public.radar_work_inputs(work_item_id,observation_id)
      values ('${renewWork}','${source}');
    update public.radar_work_items
      set state='SUCCEEDED', screening_result='PASS', screening_evaluated_at=clock_timestamp(),
          sealed_at=clock_timestamp(), input_hash=private.radar_input_fingerprint(id)
      where id='${renewWork}';
    update public.radar_work_items
      set state='RUNNING', lease_owner='f4-worker', lease_expires_at=clock_timestamp()+interval '3 seconds',
          lease_generation=0, lease_token='${renewToken}'::uuid
      where id='${renewWork}';
  `);
  assert.equal(await sql(db, `select (
    state='RUNNING' and method_version='f4-method' and input_version='f4-input'
    and reserved_analysis_version=500 and lease_owner='f4-worker'
    and lease_token='${renewToken}' and lease_generation=0
    and lease_expires_at > clock_timestamp() and sealed_at is not null
    and input_hash is not null and pause_generation=(select (configuration->>'generation')::bigint from public.feature_flags where key='radar_emergency_paused')
    and (select count(*) from public.radar_work_inputs where work_item_id=id)=1
  )::text from public.radar_work_items where id='${renewWork}';`), "true", "renewal fixture must be fully valid before the wait");
  const renewBefore = await sql(db, `select md5(to_jsonb(w)::text) from public.radar_work_items w where id='${renewWork}';`);
  let renewRelease = await hold(db, "f4-renew-row", `select id from public.radar_work_items where id='${renewWork}' for update`);
  let renewPending = command(sqlArgs(db), `begin; set application_name='f4-renew-call'; set local role service_role; select public.radar_system_renew_work('${renewWork}','f4-worker','${renewToken}',0,30); commit;`);
  await waitForLock(db, "f4-renew-call");
  assert.equal(await sql(db, `select (lease_expires_at > clock_timestamp())::text from public.radar_work_items where id='${renewWork}';`), "true", "renewal lease must still be valid when the wait is confirmed");
  await sql(db, `select pg_sleep(greatest(0, extract(epoch from lease_expires_at-clock_timestamp()))::double precision + 0.25) from public.radar_work_items where id='${renewWork}';`);
  await renewRelease();
  result = await renewPending;
  assert.equal(result.code, 0, result.stderr);
  assert.equal(result.stdout.trim(), "f", "expired renewal after work-row wait must be rejected");
  assert.equal(await sql(db, `select md5(to_jsonb(w)::text) from public.radar_work_items w where id='${renewWork}';`), renewBefore, "expired renewal must leave the complete work row unchanged");

  await sql(db, `
    insert into public.radar_work_items(id,work_kind,token_id,request_key,state,method_version,input_version,reserved_analysis_version,pause_generation)
      values ('${failWork}','SCREENING','${uuid("4f000000",100)}','f4-fail-work','QUEUED','f4-method','f4-input',502,
        (select (configuration->>'generation')::bigint from public.feature_flags where key='radar_emergency_paused'));
    insert into public.radar_work_inputs(work_item_id,observation_id) values ('${failWork}','${source}');
    update public.radar_work_items
      set state='SUCCEEDED', screening_result='PASS', screening_evaluated_at=clock_timestamp(),
          sealed_at=clock_timestamp(), input_hash=private.radar_input_fingerprint(id)
      where id='${failWork}';
    update public.radar_work_items
      set state='RUNNING', lease_owner='f4-worker', lease_token='${failToken}'::uuid,
          lease_expires_at=clock_timestamp()+interval '3 seconds', lease_generation=0
      where id='${failWork}';
  `);
  assert.equal(await sql(db, `select (
    state='RUNNING' and method_version='f4-method' and input_version='f4-input'
    and reserved_analysis_version=502 and lease_owner='f4-worker'
    and lease_token='${failToken}' and lease_generation=0
    and lease_expires_at > clock_timestamp() and sealed_at is not null
    and input_hash is not null and pause_generation=(select (configuration->>'generation')::bigint from public.feature_flags where key='radar_emergency_paused')
    and (select count(*) from public.radar_work_inputs where work_item_id=id)=1
  )::text from public.radar_work_items where id='${failWork}';`), "true", "failure fixture must be fully valid before the wait");
  const failBefore = await sql(db, `select md5(to_jsonb(w)::text) from public.radar_work_items w where id='${failWork}';`);
  let failRelease = await hold(db, "f4-fail-row", `select id from public.radar_work_items where id='${failWork}' for update`);
  let failPending = command(sqlArgs(db), `begin; set application_name='f4-fail-call'; set local role service_role; select public.radar_system_fail_work('${failWork}','f4-worker','${failToken}',0,false,'expired after wait',clock_timestamp()); commit;`);
  await waitForLock(db, "f4-fail-call");
  assert.equal(await sql(db, `select (lease_expires_at > clock_timestamp())::text from public.radar_work_items where id='${failWork}';`), "true", "failure lease must still be valid when the wait is confirmed");
  await sql(db, `select pg_sleep(greatest(0, extract(epoch from lease_expires_at-clock_timestamp()))::double precision + 0.25) from public.radar_work_items where id='${failWork}';`);
  await failRelease();
  result = await failPending;
  assert.notEqual(result.code, 0, result.stderr);
  assert.match(result.stderr, /40001/);
  assert.equal(await sql(db, `select md5(to_jsonb(w)::text) from public.radar_work_items w where id='${failWork}';`), failBefore, "expired failure report must leave the complete work row unchanged");
  console.log("F4 lease races: renewal and failure reject expired authority after real work-row waits");
}

try { await main(); console.log("Radar F4 upgrade/concurrency checks: PASS"); }
catch (error) { console.error(error.message); process.exitCode = 1; }
finally {
  for (const db of created) {
    try { await sql("postgres", `drop database ${db};`); }
    catch (error) { console.error(`Scratch cleanup blocked for ${db}: ${error.message}`); process.exitCode = 1; }
  }
  if (created.size) console.log("Removed only this run's disposable Radar F4 validation database.");
}
