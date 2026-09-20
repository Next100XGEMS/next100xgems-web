// Local-only full suite. Existing DB mode overlays the repaired schema inside
// each test transaction and rolls back; it never updates local migration history.
import { readFile, readdir } from "node:fs/promises";
import { resolve, dirname } from "node:path";
import assert from "node:assert/strict";
import { createAuditDatabase, dropAuditDatabase, command, sqlArgs } from "./analyzer-local-db.mjs";

async function expand(path) {
  let text = await readFile(path, "utf8");
  for (const reference of [...text.matchAll(/^\\ir (.+)$/gm)]) {
    const included = await expand(resolve(dirname(path), reference[1]));
    text = text.replace(reference[0], () => included);
  }
  return text;
}
const existing = process.argv.includes("--existing-overlay");
const context = await command(["context", "inspect", "--format", "{{.Endpoints.docker.Host}}"]);
assert.ok(context.code === 0 && context.stdout.trim().startsWith("unix://"), "Only local Docker permitted");
const db = existing ? "postgres" : await createAuditDatabase();
let passed = 0, failed = 0, errors = 0;
try {
  const migration = existing ? (await readFile("supabase/migrations/20260920000004_token_analyzer_receipt_integrity.sql", "utf8")).replace(/^begin;\s*/, "").replace(/commit;\s*$/, "") : "";
  for (const file of (await readdir("supabase/tests/database")).filter((name) => name.endsWith(".sql")).sort()) {
    let body = await expand(resolve("supabase/tests/database", file));
    assert.match(body, /^\s*begin;/im, "Suite tests must be rollback isolated");
    assert.match(body, /rollback;\s*$/i);
    if (existing) body = body.replace(/^\s*begin;/im, () => "begin;\n" + migration);
    const result = await command(sqlArgs(db), body);
    const ok = (result.stdout.match(/^ok \d+/gm) ?? []).length;
    const bad = (result.stdout.match(/^not ok \d+/gm) ?? []).length;
    passed += ok; failed += bad; errors += result.code ? 1 : 0;
    console.log(`${file}: ${ok} passed / ${bad} failed; exit ${result.code}`);
    if (bad || result.code) console.log(result.stdout, result.stderr);
  }
  const migrationCount = (await readdir("supabase/migrations")).filter((name) => name.endsWith(".sql")).length;
  console.log(`${existing ? "EXISTING DEVELOPMENT (transactional schema overlay)" : `CLEAN DATABASE (${migrationCount} migrations)`}: ${passed} passed / ${failed} failed / ${errors} execution errors`);
  if (failed || errors) process.exitCode = 1;
} finally { if (!existing) await dropAuditDatabase(db); }
