import { spawn } from "node:child_process";
import { readFileSync } from "node:fs";
import { randomUUID } from "node:crypto";
import { createClient, type SupabaseClient } from "@supabase/supabase-js";
import { afterAll, beforeAll, describe, expect, it, vi } from "vitest";

vi.mock("server-only", () => ({}));
const state = vi.hoisted(() => ({ userId: "", client: null as SupabaseClient | null }));
vi.mock("@/lib/auth/authorization", () => ({
  getAuthorizationContext: vi.fn(async () => ({ userId: state.userId, roles: ["admin"], permissions: [], supabase: state.client })),
}));

import { runAnalyzer } from "@/lib/token-analyzer/server";

const enabled = process.env.RUN_LOCAL_ANALYZER_INTEGRATION === "1";
const describeLocal = enabled ? describe : describe.skip;
const containerName = "supabase_db_next100xgems-web_2";

function localEnv() {
  const values = Object.fromEntries(readFileSync(".env.local", "utf8").split(/\r?\n/).filter((line) => line && !line.startsWith("#")).map((line) => {
    const index = line.indexOf("=");
    return index < 0 ? [line, ""] : [line.slice(0, index), line.slice(index + 1).replace(/^['"]|['"]$/g, "")];
  }));
  return {
    url: values.NEXT_PUBLIC_SUPABASE_URL || values.SUPABASE_URL,
    publishableKey: values.NEXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY,
    secretKey: values.SUPABASE_SECRET_KEY,
  };
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

describeLocal("Analyzer application/database concurrency", () => {
  const password = `Analyzer-local-${randomUUID()}`;
  const email = `analyzer-concurrency-${randomUUID()}@local.test`;
  const rawInput = `0x${randomUUID().replaceAll("-", "")}`;
  let admin: SupabaseClient;
  let user: SupabaseClient;

  beforeAll(async () => {
    const config = localEnv();
    if (!config.url || !config.publishableKey || !config.secretKey) throw new Error("Local Supabase credentials are not configured for the opt-in integration test.");
    admin = createClient(config.url, config.secretKey, { auth: { persistSession: false, autoRefreshToken: false, detectSessionInUrl: false } });
    user = createClient(config.url, config.publishableKey, { auth: { persistSession: false, autoRefreshToken: false, detectSessionInUrl: false } });
    const created = await admin.auth.admin.createUser({ email, password, email_confirm: true });
    if (created.error || !created.data.user) throw created.error ?? new Error("Could not create local integration user.");
    state.userId = created.data.user.id;
    await sql(`insert into public.profiles(id, display_name, status) values ('${state.userId}', 'Analyzer concurrency test', 'ACTIVE'); insert into public.user_roles(user_id, role_id) select '${state.userId}', id from public.roles where key = 'admin';`);
    const signedIn = await user.auth.signInWithPassword({ email, password });
    if (signedIn.error || !signedIn.data.session) throw signedIn.error ?? new Error("Could not sign in the local integration user.");
    state.client = user;
    const enabledResult = await user.rpc("set_token_analyzer_enabled", { p_enabled: true });
    if (enabledResult.error) throw enabledResult.error;
  });

  afterAll(async () => {
    if (!state.userId) return;
    await user?.rpc("set_token_analyzer_enabled", { p_enabled: false });
    await sql(`begin; set local session_replication_role = replica; delete from public.analyzer_model_calls where analysis_id in (select id from public.analyzer_analyses where request_id in (select id from public.analyzer_requests where raw_input = '${rawInput}')); delete from public.analyzer_provider_events where request_id in (select id from public.analyzer_requests where raw_input = '${rawInput}'); delete from public.analyzer_cost_usage where request_id in (select id from public.analyzer_requests where raw_input = '${rawInput}'); delete from public.analyzer_analyses where request_id in (select id from public.analyzer_requests where raw_input = '${rawInput}'); delete from public.analyzer_evidence_manifests where request_id in (select id from public.analyzer_requests where raw_input = '${rawInput}'); delete from public.analyzer_resolutions where request_id in (select id from public.analyzer_requests where raw_input = '${rawInput}'); delete from public.analyzer_requests where raw_input = '${rawInput}'; delete from public.user_roles where user_id = '${state.userId}'; delete from public.profiles where id = '${state.userId}'; commit;`);
    await admin?.auth.admin.deleteUser(state.userId);
    state.client = null;
  });

  it("creates one durable analysis for overlapping identical application requests", async () => {
    const results = await Promise.all(Array.from({ length: 5 }, () => runAnalyzer({ raw: rawInput, hintChain: "ethereum" })));
    expect(new Set(results.map((result) => result.requestId)).size).toBe(1);
    const requestId = results[0].requestId;
    const rows = await sql(`select count(*)::text || '|' || coalesce(max(analysis_version), 0)::text from public.analyzer_analyses where request_id = '${requestId}';`);
    expect(rows).toBe("1|1");
  });
});
