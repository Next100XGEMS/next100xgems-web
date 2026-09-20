import { spawn } from "node:child_process";
import { readFile } from "node:fs/promises";
import { fileURLToPath } from "node:url";
import path from "node:path";

export const SHADOW_CHECKPOINTS = [["T+5M", 5], ["T+15M", 15], ["T+30M", 30], ["T+1H", 60], ["T+6H", 360], ["T+24H", 1440]];
export const SHADOW_CAPTURE_WINDOW_MS = 120_000;
export const SHADOW_WATCHER_CADENCE_MS = Math.max(1_000, Math.floor(SHADOW_CAPTURE_WINDOW_MS / 2));

function checkpointAt(admission, name) { const minutes = SHADOW_CHECKPOINTS.find(([label]) => label === name)?.[1] ?? 0; return new Date(Date.parse(admission.creationTimestamp) + minutes * 60_000).toISOString(); }
function loadEnvFile(contents) { for (const line of contents.split(/\r?\n/u)) { const match = line.match(/^\s*(?:export\s+)?([A-Z][A-Z0-9_]*)\s*=\s*(.*?)\s*$/u); if (!match || process.env[match[1]]) continue; const raw = match[2]; process.env[match[1]] = raw.replace(/^['"]|['"]$/gu, ""); } }
async function loadLocalEnvironment(root) { try { loadEnvFile(await readFile(path.join(root, ".env.local"), "utf8")); } catch { /* Local credentials may already be exported. */ } }
async function loadState(outputPath) { return JSON.parse(await readFile(outputPath, "utf8")); }

export function computeWatchPlan(state, nowMs = Date.now(), captureWindowMs = SHADOW_CAPTURE_WINDOW_MS) {
  const existing = new Map((state.checkpoints ?? []).map((checkpoint) => [checkpoint.key, checkpoint]));
  const dueNow = []; const future = []; let missed = 0; let terminal = state.admissions.length > 0;
  for (const admission of state.admissions) for (const [name] of SHADOW_CHECKPOINTS) {
    const key = `${admission.mint}:${name}`; const at = Date.parse(checkpointAt(admission, name)); const checkpoint = existing.get(key); const status = checkpoint?.status;
    if (status === "CAPTURED" || status === "MISSED_WINDOW") continue;
    if (status === "PENDING_FUTURE" || (!status && nowMs < at)) future.push({ key, name, checkpointAt: new Date(at).toISOString() });
    else if (status === "DUE_NOW" || (!status && nowMs <= at + captureWindowMs)) dueNow.push({ key, name, checkpointAt: new Date(at).toISOString() });
    else missed += 1;
    terminal = false;
  }
  return { terminal, dueNow, future: future.sort((a, b) => Date.parse(a.checkpointAt) - Date.parse(b.checkpointAt)), missed, nextDueAt: dueNow.length ? nowMs : future.length ? Date.parse(future[0].checkpointAt) : null };
}

export function createStopSignal() { let stopped = false; return { stop: () => { stopped = true; }, isStopped: () => stopped }; }

const root = process.cwd();
const outputPath = process.env.RADAR_SHADOW_STATE ?? path.join(root, "tests/data/radar-pump-shadow-20260920.json");
const collectorPath = path.join(root, "scripts/radar-shadow-collect.mjs");
const stopSignal = createStopSignal();
let timer = null;
let child = null;

function stopWatcher(signal) { stopSignal.stop(); if (timer) clearTimeout(timer); if (child) child.kill("SIGINT"); else process.stdout.write(`${JSON.stringify({ mode: "DEVELOPMENT_SHADOW_WATCH", stopped: true, signal })}\n`); }

function wait(ms) { return new Promise((resolve) => { timer = setTimeout(() => { timer = null; resolve(); }, ms); }); }
function runCollector() { return new Promise((resolve, reject) => { child = spawn(process.execPath, [collectorPath, outputPath, "100", "20"], { cwd: root, env: process.env, stdio: "inherit" }); child.once("error", reject); child.once("exit", (code, signal) => { child = null; if (code === 0 || signal === "SIGINT") resolve(); else reject(new Error(`Shadow collector exited with code ${code ?? "unknown"}.`)); }); }); }

async function main() {
  process.once("SIGINT", () => stopWatcher("SIGINT"));
  process.once("SIGTERM", () => stopWatcher("SIGTERM"));
  await loadLocalEnvironment(root);
  await runCollector();
  while (!stopSignal.isStopped()) {
    const plan = computeWatchPlan(await loadState(outputPath));
    if (plan.terminal) { process.stdout.write(`${JSON.stringify({ mode: "DEVELOPMENT_SHADOW_WATCH", stopped: true, reason: "T+24H_TERMINAL" })}\n`); return; }
    if (plan.dueNow.length) { await runCollector(); continue; }
    const waitMs = Math.max(1_000, Math.min(SHADOW_WATCHER_CADENCE_MS, Math.max(0, (plan.nextDueAt ?? Date.now() + SHADOW_WATCHER_CADENCE_MS) - Date.now())));
    process.stdout.write(`${JSON.stringify({ mode: "DEVELOPMENT_SHADOW_WATCH", nextDueAt: plan.nextDueAt ? new Date(plan.nextDueAt).toISOString() : null, dueNow: 0, pendingFuture: plan.future.length, missed: plan.missed, cadenceMs: SHADOW_WATCHER_CADENCE_MS })}\n`);
    await wait(waitMs);
  }
}

if (process.argv[1] && path.resolve(process.argv[1]) === fileURLToPath(import.meta.url)) main().catch((error) => { process.stderr.write(`${error.message}\n`); process.exitCode = 1; });
