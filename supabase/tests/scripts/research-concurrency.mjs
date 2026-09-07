// LOCAL ONLY. Uses existing Docker/Supabase, Node built-ins, and disposable
// databases. Copies Auth/extension schema (never data/credentials), replays real
// migrations, then removes only databases this process successfully created.
import assert from "node:assert/strict";
import { spawn } from "node:child_process";
import { randomUUID } from "node:crypto";
import { readFile, readdir } from "node:fs/promises";
import process from "node:process";
import { setTimeout as delay } from "node:timers/promises";

const container = "supabase_db_next100xgems-web_2";
const created = new Set();
let checks = 0;
function command(args, input = "") {
  return new Promise((resolve, reject) => {
    const child = spawn("docker", args, { stdio: ["pipe", "pipe", "pipe"] });
    let stdout = "", stderr = "";
    child.stdout.on("data", (b) => { stdout += b; });
    child.stderr.on("data", (b) => { stderr += b; });
    child.on("error", reject);
    child.on("close", (code) => resolve({ code, stdout, stderr }));
    child.stdin.on("error", () => {});
    child.stdin.end(input);
  });
}
const sqlArgs = (db) => ["exec", "-i", container, "psql", "-X", "-qAt", "-U", "postgres", "-d", db, "-v", "ON_ERROR_STOP=1", "-v", "VERBOSITY=verbose"];
async function sql(db, text, expectedCode = 0) {
  const result = await command(sqlArgs(db), text);
  assert.equal(result.code, expectedCode, result.stderr);
  return result.stdout.trim();
}
function pass(label) { checks++; console.log("PASS: " + label); }
const actor1 = "10000000-0000-4000-8000-000000000001";
const actor2 = "10000000-0000-4000-8000-000000000002";
const article = "10000000-0000-4000-8000-000000000107";
function auth(actor) {
  return "select set_config('request.jwt.claim.sub','" + actor + "',true); " +
    "select set_config('request.jwt.claims','" + JSON.stringify({ sub: actor, role: "authenticated" }) +
    "',true); set local role authenticated;";
}
class Session {
  constructor(db) {
    this.child = spawn("docker", sqlArgs(db), { stdio: ["pipe", "pipe", "pipe"] });
    this.output = ""; this.errors = ""; this.pending = null;
    this.child.stdout.on("data", (b) => {
      this.output += b;
      if (this.pending && this.output.includes(this.pending.marker)) {
        this.pending.resolve(); this.pending = null; this.output = "";
      }
    });
    this.child.stderr.on("data", (b) => { this.errors += b; });
    this.closed = new Promise((resolve) => this.child.on("close", (code) => {
      if (this.pending) this.pending.reject(new Error(this.errors));
      this.pending = null; resolve(code);
    }));
    this.child.on("error", (e) => { if (this.pending) this.pending.reject(e); });
    this.child.stdin.on("error", () => {});
  }
  run(text) {
    return new Promise((resolve, reject) => {
      assert.equal(this.pending, null);
      const marker = "done_" + randomUUID().replaceAll("-", "");
      this.pending = { resolve, reject, marker };
      this.child.stdin.write(text + "\n\\echo " + marker + "\n");
    });
  }
  async close() { this.child.stdin.end("\\q\n"); await this.closed; }
}
async function contention(db, first, second, expectedState, label) {
  const holder = new Session(db);
  const app = "g18b_" + randomUUID().slice(0, 8);
  let waiter;
  try {
    await holder.run("begin; set local statement_timeout='10s'; " + first);
    waiter = command(sqlArgs(db), "begin; set local statement_timeout='10s'; set local application_name='" + app + "'; " + second + "; commit;");
    let blocked = false;
    for (let i = 0; i < 60; i++) {
      blocked = (await sql(db, "select exists(select 1 from pg_stat_activity where datname=current_database() and application_name='" + app + "' and wait_event_type='Lock');")) === "t";
      if (blocked) break;
      await delay(50);
    }
    assert.ok(blocked, label + ": must actually contend on a database lock");
    await holder.run("commit;");
    const result = await waiter;
    if (expectedState === null) assert.equal(result.code, 0, result.stderr);
    else {
      assert.notEqual(result.code, 0, label + ": unexpectedly succeeded");
      assert.ok(result.stderr.includes(expectedState), result.stderr);
    }
    pass(label);
  } finally {
    await holder.close(); // rolls back an uncommitted holder on a failed check
    if (waiter) await waiter;
  }
}

async function main() {
  assert.ok(!process.env.DOCKER_HOST || process.env.DOCKER_HOST.startsWith("unix://"), "Refusing nonlocal Docker host");
  const context = await command(["context", "inspect", "--format", "{{.Endpoints.docker.Host}}"]);
  assert.equal(context.code, 0, context.stderr);
  assert.ok(context.stdout.trim().startsWith("unix://"), "Refusing nonlocal Docker context");
  assert.equal(await sql("postgres", "select count(*) from public.articles;"), "0", "Validation requires disposable empty project Research state");
  const dump = await command(["exec", container, "pg_dump", "-U", "postgres", "-d", "postgres",
    "--schema-only", "--no-owner", "--no-privileges", "--schema=auth", "--schema=extensions"]);
  assert.equal(dump.code, 0, dump.stderr);
  const migrationsDir = new URL("../../migrations/", import.meta.url);
  const migrations = await Promise.all((await readdir(migrationsDir)).filter((p) => p.endsWith(".sql")).sort()
    .map((p) => readFile(new URL(p, migrationsDir), "utf8")));
  assert.equal(migrations.length, 8, "Review harness when migration inventory changes");
  async function database(count = 8) {
    const name = "next100xgems_gate18b_" + randomUUID().replaceAll("-", "").slice(0, 12);
    assert.match(name, /^next100xgems_gate18b_[a-f0-9]{12}$/);
    await sql("postgres", "create database " + name + ";");
    created.add(name);
    await sql(name, dump.stdout);
    for (const migration of migrations.slice(0, count)) await sql(name, migration);
    return name;
  }
  const db = await database();
  const fixture = await readFile(new URL("../fixtures/research.inc", import.meta.url), "utf8");
  await sql(db, "begin;\n" + fixture + "\nselect pg_temp.research_fixture(array['editor']); " +
    "insert into public.user_roles(user_id,role_id) select '" + actor2 + "',id from public.roles where key='editor'; commit;");
  pass("Independent scratch database replays all eight real migrations");
  const save = (rev, title) => "select public.save_research_draft('" + article + "'," + rev + ",'{\"title\":\"" + title + "\"}');";
  const transition = (rev, action) => "select public.transition_research_article('" + article + "'," + rev + ",'" + action + "',null,'Concurrency test');";
  await contention(db, auth(actor1) + save(1, "Winner"), auth(actor2) + save(1, "Stale"), "40001", "Two editors: one revision winner, stale writer denied");
  assert.equal(await sql(db, "select title||':'||revision from public.articles where id='" + article + "';"), "Winner:2");
  await contention(db, auth(actor1) + save(2, "Saved before publish"), auth(actor2) + transition(2, "publish"), "40001", "Save versus publication cannot publish a stale revision");
  await contention(db, auth(actor1) + "select public.save_research_draft('" + article + "',3,'{\"sources\":[{\"title\":\"New source\",\"publisher\":\"Test\",\"url\":\"https://example.test/new\"}]}');",
    auth(actor2) + transition(3, "archive"), "40001", "Child save and archive share parent revision lock");
  await sql(db, "insert into public.user_roles(user_id,role_id) select '" + actor1 + "',id from public.roles where key='admin';");
  await contention(db, auth(actor1) + "select public.change_research_classification('" + article + "',4,'SPONSORED','Paid fixture disclosure','Classification review');",
    auth(actor2) + transition(4, "publish"), "40001", "Classification versus publication cannot race");
  await contention(db, "delete from public.user_roles where user_id='" + actor2 + "';",
    auth(actor2) + save(5, "Revoked writer"), "42501", "Committed role revocation denies a waiting operation");
  await contention(db, "update public.profiles set status='SUSPENDED' where id='" + actor1 + "';",
    auth(actor1) + save(5, "Suspended writer"), "42501", "Committed suspension denies a waiting operation");
  await sql(db, "update public.profiles set status='ACTIVE' where id='" + actor1 + "';");
  await contention(db, "update public.feature_flags set enabled=false where key='research_enabled';",
    auth(actor1) + transition(5, "publish"), "55000", "Availability disablement prevents waiting publication");
  await sql(db, "update public.feature_flags set enabled=true where key='research_enabled'; " +
    "insert into public.user_roles(user_id,role_id) select '" + actor2 + "',id from public.roles where key='admin';");
  await contention(db, auth(actor1) + transition(5, "publish"),
    auth(actor2) + "select public.save_research_author('" + actor1 + "','Rewrite history');", "55000",
    "First publication freezes the byline across concurrent sessions");
  await contention(db, auth(actor1) + "select public.save_research_draft('10000000-0000-4000-8000-000000000102',1,'{\"title\":\"Before conflict\"}');",
    "insert into public.user_roles(user_id,role_id) select '" + actor1 + "',id from public.roles where key='ad_manager';", null,
    "Conflicting role insertion waits behind an already-authorized operation");
  const denied = await command(sqlArgs(db), "begin;" + auth(actor1) + "select public.save_research_draft('10000000-0000-4000-8000-000000000102',2,'{\"title\":\"After conflict\"}'); commit;");
  assert.notEqual(denied.code, 0); assert.ok(denied.stderr.includes("42501"), denied.stderr);
  assert.equal(await sql(db, "select count(*) from public.audit_logs;"), "6");
  pass("Next request rejects conflicting roles; denied races leave no success audits");

  const upgrade = await database(6);
  await sql(upgrade, "insert into public.articles(title,slug,body_markdown) values('Legacy draft','legacy-draft','Preserve original Markdown');");
  for (const migration of migrations.slice(6)) await sql(upgrade, migration);
  assert.equal(await sql(upgrade, "select body_markdown||':'||status||':'||revision from public.articles where slug='legacy-draft';"), "Preserve original Markdown:DRAFT:1");
  assert.equal(await sql(upgrade, "select count(*) from public.read_public_research_page();"), "0");
  pass("Populated compatible legacy draft upgrades without deletion, rewriting or public exposure");
  const blocked = await database(6);
  await sql(blocked, "insert into public.articles(title,slug,classification,disclosure) values('Ambiguous legacy AI','legacy-ai','AI_ASSISTED','Legacy disclosure');");
  const refused = await command(sqlArgs(blocked), migrations[6]);
  assert.notEqual(refused.code, 0); assert.ok(refused.stderr.includes("55000"), refused.stderr);
  assert.equal(await sql(blocked, "select classification from public.articles where slug='legacy-ai';"), "AI_ASSISTED");
  assert.equal(await sql(blocked, "select count(*) from information_schema.columns where table_schema='public' and table_name='articles';"), "15");
  pass("Ambiguous legacy upgrade aborts transaction without schema/data mutation");
  console.log("Research concurrency/upgrade checks: " + checks + "/" + checks + " PASS");
}
try { await main(); }
catch (error) { console.error(error.message); process.exitCode = 1; }
finally {
  for (const db of created) {
    // Exact generated targets owned by this invocation; never the project DB.
    try { await sql("postgres", "drop database " + db + ";"); }
    catch (error) { console.error("Scratch cleanup blocked for " + db + ": " + error.message); process.exitCode = 1; }
  }
  if (created.size) console.log("Removed only this run's disposable validation databases.");
}
