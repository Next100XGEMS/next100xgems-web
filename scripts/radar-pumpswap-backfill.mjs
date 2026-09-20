import { readFile, writeFile } from "node:fs/promises";

const corpusPath = process.argv[2] ?? "tests/data/radar-pump-historical-universe-20260919.json";
const outputPath = process.argv[3] ?? "tests/data/radar-pumpswap-validation-20260919.json";
const key = process.env.HELIUS_API_KEY;
if (!key) throw new Error("HELIUS_API_KEY is required locally; its value is never printed.");
const PUMP = "6EF8rrecthR5Dkzon8Nwu78hRvfCKubJ14M5uBEwF6P";
const AMM = "pAMMBay6oceH9fJKBRHGP5D4bD4sWpmSwMn52FMfXEA";
const SOL = "So11111111111111111111111111111111111111112";
const alphabet = "123456789ABCDEFGHJKLMNPQRSTUVWXYZabcdefghijkmnopqrstuvwxyz";
const endpoint = `https://mainnet.helius-rpc.com/?api-key=${encodeURIComponent(key)}`;
const migrate = Uint8Array.from([155, 234, 231, 146, 236, 158, 162, 30]);
const migrateV2 = Uint8Array.from([187, 203, 18, 31, 206, 237, 254, 41]);
let calls = 0;
function decodeBase58(value) { let n = 0n; for (const c of value) n = n * 58n + BigInt(alphabet.indexOf(c)); const out = []; while (n) { out.unshift(Number(n % 256n)); n /= 256n; } for (const c of value) { if (c !== "1") break; out.unshift(0); } return Uint8Array.from(out); }
function starts(data, prefix) { return prefix.every((byte, index) => data[index] === byte); }
async function rpc(method, params) { calls += 1; const response = await fetch(endpoint, { method: "POST", headers: { "content-type": "application/json", accept: "application/json" }, body: JSON.stringify({ jsonrpc: "2.0", id: calls, method, params }) }); return await response.json(); }
function instructions(tx) { return [...(tx?.transaction?.message?.instructions ?? []), ...(tx?.meta?.innerInstructions ?? []).flatMap((group) => group.instructions ?? [])]; }
function decodePool(address, account) { const bytes = Uint8Array.from(Buffer.from(account?.data?.[0] ?? "", "base64")); if (account?.owner !== AMM || bytes.length < 107) return null; const pubkey = (offset) => { if (offset + 32 > bytes.length) return null; let n = 0n; for (const byte of bytes.slice(offset, offset + 32)) n = n * 256n + BigInt(byte); let value = ""; while (n) { value = alphabet[Number(n % 58n)] + value; n /= 58n; } for (const byte of bytes.slice(offset, offset + 32)) { if (byte) break; value = `1${value}`; } return value; }; const index = (bytes[9] ?? 0) | ((bytes[10] ?? 0) << 8); return { address, owner: account.owner, index, canonical: index === 0, baseMint: pubkey(43), quoteMint: pubkey(75), dataBytes: bytes.length }; }
function findMigration(tx, token) { for (const instruction of instructions(tx)) { if (instruction.programId !== PUMP || typeof instruction.data !== "string") continue; const data = decodeBase58(instruction.data); const name = starts(data, migrate) ? "migrate" : starts(data, migrateV2) ? "migrate_v2" : null; if (!name) continue; const accounts = instruction.accounts ?? []; const mint = accounts[2]; const curve = accounts[name === "migrate" ? 3 : 4]; if (mint !== token.mint || curve !== token.bondingCurveAddress) continue; return { name, poolAddress: accounts[name === "migrate" ? 9 : 10] ?? null, poolAuthority: accounts[name === "migrate" ? 10 : 11] ?? null, quoteMint: name === "migrate" ? SOL : accounts[3] ?? null }; } return null; }
const corpusText = corpusPath === "-" ? await new Promise((resolve, reject) => { let value = ""; process.stdin.setEncoding("utf8"); process.stdin.on("data", (chunk) => { value += chunk; }); process.stdin.on("end", () => resolve(value)); process.stdin.on("error", reject); }) : await readFile(corpusPath, "utf8");
const corpus = JSON.parse(corpusText);
const completed = corpus.tokens.filter((token) => token.lifecycleCurrent?.complete === true);
const records = [];
for (const token of completed) {
  const signatures = await rpc("getSignaturesForAddress", [token.bondingCurveAddress, { limit: 50, commitment: "confirmed" }]);
  const list = Array.isArray(signatures.result) ? signatures.result : [];
  const transactions = [];
  for (let offset = 0; offset < list.length; offset += 10) transactions.push(...await Promise.all(list.slice(offset, offset + 10).map((item) => rpc("getTransaction", [item.signature, { encoding: "jsonParsed", commitment: "confirmed", maxSupportedTransactionVersion: 0 }]))));
  const candidates = transactions.map((response) => { const tx = response.result; if (!tx) return null; const migration = findMigration(tx, token); return migration ? { tx, migration } : null; }).filter(Boolean);
  const unique = candidates.filter((candidate, index, all) => all.findIndex((item) => item.migration.poolAddress === candidate.migration.poolAddress) === index);
  if (unique.length !== 1) { records.push({ mint: token.mint, bondingCurve: token.bondingCurveAddress, status: unique.length > 1 ? "AMBIGUOUS" : "NOT_FOUND", migrationSignature: unique.length === 1 ? unique[0].tx.transaction.signatures[0] : null, migrationSlot: unique.length === 1 ? unique[0].tx.slot : null, poolAddress: unique.length === 1 ? unique[0].migration.poolAddress : null, pool: null, reason: unique.length > 1 ? "More than one explicit migration pool was found in the bounded transaction window." : "No matching explicit migrate/migrate_v2 transaction was found in the bounded transaction window." }); continue; }
  const candidate = unique[0]; const poolResponse = await rpc("getAccountInfo", [candidate.migration.poolAddress, { encoding: "base64", commitment: "confirmed" }]); const pool = decodePool(candidate.migration.poolAddress, poolResponse.result?.value); const valid = Boolean(pool && pool.canonical && pool.baseMint === token.mint && pool.quoteMint === candidate.migration.quoteMint);
  records.push({ mint: token.mint, bondingCurve: token.bondingCurveAddress, status: valid ? "LINKED" : pool ? "MIGRATION_FOUND_POOL_INVALID" : "MIGRATION_FOUND_POOL_UNAVAILABLE", migrationSignature: candidate.tx.transaction.signatures[0] ?? null, migrationSlot: candidate.tx.slot ?? null, migrationTimestamp: typeof candidate.tx.blockTime === "number" ? new Date(candidate.tx.blockTime * 1000).toISOString() : null, poolAddress: candidate.migration.poolAddress, poolAuthority: candidate.migration.poolAuthority, baseMint: candidate.migration.quoteMint === SOL ? token.mint : candidate.migration.quoteMint, quoteMint: candidate.migration.quoteMint, pool, reason: valid ? "Explicit official migration and PumpSwap-owned canonical Pool agree." : "Explicit migration was found but Pool identity did not fully verify." });
}
const linked = records.filter((record) => record.status === "LINKED").length;
await writeFile(outputPath, JSON.stringify({ schemaVersion: "radar-pumpswap-validation-v1", generatedAt: new Date().toISOString(), readOnly: true, officialPrograms: { pump: PUMP, pumpSwap: AMM }, completedCurvesTested: completed.length, records, metrics: { rpcCalls: calls, estimatedHeliusCredits: null, billingNote: "Standard RPC billing was not exposed; no 100-credit gTFA estimate is applied to these RPC calls." }, summary: { migrationFound: records.filter((record) => record.migrationSignature).length, linked, ambiguous: records.filter((record) => record.status === "AMBIGUOUS").length, unavailable: records.filter((record) => record.status === "MIGRATION_FOUND_POOL_UNAVAILABLE").length, falseLinkage: records.filter((record) => record.status === "MIGRATION_FOUND_POOL_INVALID").length } }, null, 2));
console.log(JSON.stringify({ completedCurvesTested: completed.length, migrationFound: records.filter((record) => record.migrationSignature).length, linked, rpcCalls: calls, outputPath }));
