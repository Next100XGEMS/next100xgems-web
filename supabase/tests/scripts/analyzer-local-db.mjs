import { spawn } from "node:child_process";
import { readFile, readdir } from "node:fs/promises";
import { randomUUID } from "node:crypto";
import assert from "node:assert/strict";
import { resolve } from "node:path";

export const container = "supabase_db_next100xgems-web_2";
export function command(args, input = "") {
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
export function sqlArgs(database) { return ["exec", "-i", container, "psql", "-X", "-qAt", "-U", "postgres", "-d", database, "-v", "ON_ERROR_STOP=1"]; }
export async function sql(database, statement) {
  const result = await command(sqlArgs(database), statement);
  assert.equal(result.code, 0, result.stderr);
  return result.stdout.trim();
}
export async function createAuditDatabase(limit = Infinity) {
  const context = await command(["context", "inspect", "--format", "{{.Endpoints.docker.Host}}"]);
  assert.equal(context.code, 0);
  assert.ok(context.stdout.trim().startsWith("unix://"), "Only local Docker permitted");
  const db = `analyzer_contract_${randomUUID().replaceAll("-", "").slice(0, 12)}`;
  const dump = await command(["exec", container, "pg_dump", "-U", "postgres", "-d", "postgres", "--schema-only", "--no-owner", "--no-privileges", "--schema=auth", "--schema=extensions"]);
  assert.equal(dump.code, 0, dump.stderr);
  await sql("postgres", `create database ${db}`);
  try {
    await sql(db, dump.stdout);
    const migrations = resolve("supabase/migrations");
    const files = (await readdir(migrations)).filter((f) => f.endsWith(".sql")).sort();
    for (const file of files.slice(0, limit)) await sql(db, await readFile(resolve(migrations, file), "utf8"));
    await sql(db, "create extension if not exists pgtap with schema extensions; grant usage on schema auth,extensions to anon,authenticated,service_role; grant execute on all functions in schema auth,extensions to anon,authenticated,service_role;");
    return db;
  } catch (error) { await dropAuditDatabase(db); throw error; }
}
export async function dropAuditDatabase(db) {
  assert.match(db, /^analyzer_contract_[0-9a-f]{12}$/);
  await sql("postgres", `drop database ${db}`);
}
export function authSql(userId) {
  assert.match(userId, /^[0-9a-f-]{36}$/);
  return `select set_config('request.jwt.claims','{"sub":"${userId}","role":"authenticated"}',true);select set_config('request.jwt.claim.sub','${userId}',true);set local role authenticated;`;
}
