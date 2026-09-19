// LOCAL ONLY. Run the additive F4 pgTAP contract in a disposable database.
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
async function sql(db, statement) {
  const result = await command(sqlArgs(db), statement);
  assert.equal(result.code, 0, result.stderr);
  return result.stdout.trim();
}

async function main() {
  const context = await command(["context", "inspect", "--format", "{{.Endpoints.docker.Host}}"]);
  assert.equal(context.code, 0, context.stderr);
  assert.ok(context.stdout.trim().startsWith("unix://"), "refusing nonlocal Docker context");
  const dump = await command(["exec", container, "pg_dump", "-U", "postgres", "-d", "postgres",
    "--schema-only", "--no-owner", "--no-privileges", "--schema=auth", "--schema=extensions"]);
  assert.equal(dump.code, 0, dump.stderr);
  const migrationsDir = new URL("../../migrations/", import.meta.url);
  const files = (await readdir(migrationsDir)).filter((file) => file.endsWith(".sql")).sort();
  assert.ok(files.length >= 20, "F4 pgTAP harness must replay the complete migration set");
  const migrations = await Promise.all(files.map((file) => readFile(new URL(file, migrationsDir), "utf8")));
  const testSql = await readFile(new URL("../database/radar_gate19c_f4.test.sql", import.meta.url), "utf8");
  const db = `next100xgems_gate19cf4_pgtap_${randomUUID().replaceAll("-", "").slice(0, 10)}`;
  await sql("postgres", `create database ${db};`);
  created.add(db);
  await sql(db, dump.stdout);
  for (const migration of migrations) await sql(db, migration);
  const result = await command(sqlArgs(db), testSql);
  assert.equal(result.code, 0, result.stderr);
  assert.doesNotMatch(result.stdout, /^not ok /m, result.stdout);
  console.log(result.stdout);
  console.log("Radar F4 pgTAP: PASS");
}

try { await main(); }
catch (error) { console.error(error.stack || error.message); process.exitCode = 1; }
finally {
  for (const db of created) {
    try { await sql("postgres", `drop database ${db};`); }
    catch (error) { console.error(`Scratch cleanup blocked for ${db}: ${error.message}`); process.exitCode = 1; }
  }
  if (created.size) console.log("Removed only this run's disposable Radar F4 pgTAP database.");
}
