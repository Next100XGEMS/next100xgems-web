import "server-only";

import { collectPumpLifecycle, PUMP_PROGRAM_ID, isValidSolanaPublicKey } from "@/lib/radar/acceptance/solana";
import { canonicalAddress, verifySolanaMint, totalSupplyShare, TOKEN_PROGRAM, TOKEN_2022_PROGRAM } from "./provider-integrity";
import type { AnalyzerCapabilityStatus, AnalyzerInput, AnalyzerObservation, AnalyzerProviderConflict, AnalyzerProviderUsage, AnalyzerResolution } from "./contracts";
import { createEvidenceManifest } from "./evidence";
import { resolveAnalyzerInput } from "./input-resolver";

type JsonRecord = Record<string, unknown>;
type SeedMarket = { provider: "dex-screener"; pair: JsonRecord; pairs: JsonRecord[] } | null;
export type LivePreparedResolution = { resolution: AnalyzerResolution; seedMarket: SeedMarket; usage: AnalyzerProviderUsage[]; statuses: AnalyzerCapabilityStatus[] };
export type LiveCollection = { manifest: ReturnType<typeof createEvidenceManifest>; usage: AnalyzerProviderUsage[]; statuses: AnalyzerCapabilityStatus[] };

const TIMEOUT_MS = 8_000;
const RETRIES = 1;
const DEX_CHAIN: Record<string, string> = { solana: "solana", ethereum: "ethereum", base: "base", bnb: "bsc" };
const BASE58 = "123456789ABCDEFGHJKLMNPQRSTUVWXYZabcdefghijkmnopqrstuvwxyz";

function now() { return new Date().toISOString(); }
function safeError(error: unknown) { return error && typeof error === "object" && "name" in error && error.name === "AbortError" ? "TIMEOUT" : "PROVIDER_ERROR"; }
function decimal(value: unknown): string | null {
  if (typeof value === "string" && /^(0|[1-9][0-9]*)(\.[0-9]+)?$/.test(value)) return value;
  if (typeof value !== "number" || !Number.isFinite(value)) return null;
  const fixed = value.toFixed(12).replace(/0+$/, "").replace(/\.$/, "");
  return fixed === "-0" ? "0" : fixed;
}
function integer(value: unknown): string | null {
  if (typeof value === "string" && /^(0|[1-9][0-9]*)$/.test(value)) return value;
  if (typeof value === "number" && Number.isSafeInteger(value) && value >= 0) return String(value);
  return null;
}
function base58Encode(bytes: Uint8Array) { let number = BigInt(0); for (const byte of bytes) number = number * BigInt(256) + BigInt(byte); let output = ""; while (number > BigInt(0)) { output = BASE58[Number(number % BigInt(58))] + output; number /= BigInt(58); } for (const byte of bytes) { if (byte !== 0) break; output = `1${output}`; } return output; }
function evmAddress(value: unknown) { return typeof value === "string" && /^0x[0-9a-fA-F]{40}$/.test(value) ? value.toLowerCase() : null; }
function chainForDex(chain: string) { return DEX_CHAIN[chain] ?? chain; }

export async function jsonRequest(url: string, init: RequestInit, provider: string, capability: string, usage: AnalyzerProviderUsage[]): Promise<JsonRecord | null> {
  let lastError: string | null = null, attempts = 0;
  const started = Date.now();
  let outcome: NonNullable<AnalyzerProviderUsage["requestOutcome"]> = "HTTP_ERROR";
  for (let attempt = 0; attempt <= RETRIES; attempt += 1) {
    const controller = new AbortController(), timer = setTimeout(() => controller.abort(), TIMEOUT_MS);
    try {
      attempts++;
      const response = await fetch(url, { ...init, redirect: "error", signal: controller.signal });
      if (!response.ok) {
        await response.body?.cancel();
        lastError = response.status === 429 ? "RATE_LIMITED" : `HTTP_${response.status}`;
        outcome = response.status === 429 ? "RATE_LIMIT" : "HTTP_ERROR";
        // No 429 retry storm: use fallback immediately. One bounded retry for 5xx.
        if (response.status < 500 || attempt === RETRIES) break;
        await new Promise((resolve) => setTimeout(resolve, 250));
        continue;
      }
      const reader = response.body?.getReader();
      const chunks: Uint8Array[] = []; let size = 0;
      if (reader) try {
        while (true) { const next = await reader.read(); if (next.done) break; size += next.value.byteLength; if (size > 2_000_000) { await reader.cancel(); throw new Error("INVALID_RESPONSE"); } chunks.push(next.value); }
      } finally { reader.releaseLock(); }
      const payload: unknown = JSON.parse(Buffer.concat(chunks).toString("utf8"));
      if (!payload || typeof payload !== "object" || Array.isArray(payload) || Object.hasOwn(payload, "error") || (payload as JsonRecord).success === false
        || (["helius", "alchemy"].includes(provider) && !Object.hasOwn(payload, "result"))
        || (provider === "dex-screener" && !((payload as JsonRecord).pairs === null || Array.isArray((payload as JsonRecord).pairs)))
        || (provider === "birdeye" && (!(payload as JsonRecord).data || typeof (payload as JsonRecord).data !== "object" || Array.isArray((payload as JsonRecord).data)))) {
        outcome = "INVALID_RESPONSE"; lastError = "INVALID_RESPONSE"; break;
      }
      usage.push({ provider, capability, status: "SUCCESS", requestOutcome: "SUCCESS", capabilityStatus: "UNKNOWN", latencyMs: Date.now() - started, attempts, cache: "MISS", error: null });
      return payload as JsonRecord;
    } catch (error) {
      lastError = safeError(error);
      outcome = lastError === "TIMEOUT" ? "TIMEOUT" : "INVALID_RESPONSE";
      break;
    } finally { clearTimeout(timer); }
  }
  usage.push({ provider, capability, status: outcome === "RATE_LIMIT" ? "RATE_LIMITED" : "FAILED", requestOutcome: outcome, capabilityStatus: "UNKNOWN", latencyMs: Date.now() - started, attempts, cache: "MISS", error: lastError });
  return null;
}

function configured(name: string) { return typeof process.env[name] === "string" && process.env[name]!.trim().length > 0; }
function status(provider: string, capability: string, value: AnalyzerCapabilityStatus["status"]): AnalyzerCapabilityStatus { return { provider, capability, status: value }; }
function observation(key: string, label: string, value: string, source: string, evidenceClass: "VERIFIED_DATA" | "STRONG_SIGNAL", resolution: AnalyzerResolution, identityType: "TOKEN" | "POOL" | "WALLET", identity: string, referenceType: "TOKEN" | "POOL" | "WALLET" | "TRANSACTION", transactionReference?: string): AnalyzerObservation {
  const tokenId = resolution.canonicalTokenId!; const reference = referenceType === "TRANSACTION" ? transactionReference! : identity;
  const result: AnalyzerObservation = { context: { scope: identityType === "POOL" ? "POOL" : "TOKEN_AGGREGATE", chain: resolution.chain, token: resolution.tokenAddress!, poolId: identityType === "POOL" ? identity : null, quoteAsset: null, timeWindow: null, retrievedAt: now(), completeness: "UNKNOWN", classification: evidenceClass === "VERIFIED_DATA" ? "DIRECT" : "PROVIDER_DERIVED", methodology: null }, key, label, value, state: "AVAILABLE", evidenceClass, source, observedAt: now(), evidenceId: `${source}:${key}:${identity}:${Date.now()}`, identity, identityType, tokenId, provenance: [{ source, kind: evidenceClass === "VERIFIED_DATA" ? (source === "helius" || source === "solana-rpc" || source === "alchemy" ? "DIRECT_CHAIN" : "OBJECTIVE_PROVIDER") : "PROVIDER_DERIVED", reference, referenceType, capturedAt: now() }] };
  if (transactionReference) result.transactionReference = transactionReference;
  return result;
}

function dexPairs(payload: JsonRecord | null) { return Array.isArray(payload?.pairs) ? payload!.pairs.filter((item): item is JsonRecord => Boolean(item && typeof item === "object")) : []; }
function pairMatches(pair: JsonRecord, chain: string, token: string) {
  const base = pair.baseToken as JsonRecord | undefined;
  return pair.chainId === chainForDex(chain) && canonicalAddress(chain, base?.address) === token;
}
export class ProviderIdentityError extends Error { readonly code = "IDENTITY_CONFLICT"; constructor() { super("Provider identity conflicts with the requested chain, token or pool."); } }
function selectPair(pairs: JsonRecord[], chain: string, token: string) {
  return pairs.filter((pair) => pairMatches(pair, chain, token)).sort((a, b) => Number(((b.liquidity as JsonRecord | undefined)?.usd) ?? 0) - Number(((a.liquidity as JsonRecord | undefined)?.usd) ?? 0))[0] ?? null;
}
async function fetchDexMarket(chain: string, token: string | null, pairAddress: string | null, usage: AnalyzerProviderUsage[]): Promise<SeedMarket> {
  if (!token && !pairAddress) return null;
  const path = pairAddress ? `/latest/dex/pairs/${encodeURIComponent(chainForDex(chain))}/${encodeURIComponent(pairAddress)}` : `/latest/dex/tokens/${encodeURIComponent(token!)}`;
  const payload = await jsonRequest(`https://api.dexscreener.com${path}`, { headers: { accept: "application/json" } }, "dex-screener", "MARKET", usage);
  const pairs = dexPairs(payload);
  if (pairAddress && pairs.some((pair) => pair.chainId !== chainForDex(chain) || canonicalAddress(chain, pair.pairAddress) !== pairAddress || !canonicalAddress(chain, (pair.baseToken as JsonRecord)?.address) || !canonicalAddress(chain, (pair.quoteToken as JsonRecord)?.address) || (token && !pairMatches(pair, chain, token)))) throw new ProviderIdentityError();
  const selected = pairAddress ? pairs[0] : selectPair(pairs, chain, token!);
  // A nonempty response containing only other identities is a conflict, not a new resolution.
  if (!selected && pairs.length) throw new ProviderIdentityError();
  return selected ? { provider: "dex-screener", pair: selected, pairs } : null;
}
function addDexObservations(seed: SeedMarket, resolution: AnalyzerResolution, observations: AnalyzerObservation[]) {
  if (!seed || !resolution.tokenAddress || !resolution.canonicalTokenId) return;
  const start = observations.length;
  const pair = seed.pair; const rawPool = typeof pair.pairAddress === "string" ? pair.pairAddress : null; const pool = rawPool && (resolution.chain === "solana" ? isValidSolanaPublicKey(rawPool) : Boolean(evmAddress(rawPool))) ? rawPool : null;
  const price = decimal(pair.priceUsd); const liquidity = decimal((pair.liquidity as JsonRecord | undefined)?.usd); const volume = decimal((pair.volume as JsonRecord | undefined)?.h24); const txns = (pair.txns as JsonRecord | undefined)?.h24 as JsonRecord | undefined; const transactionCount = integer(txns && integer(txns.buys) !== null && integer(txns.sells) !== null ? Number(txns.buys) + Number(txns.sells) : null);
  if (price) observations.push(observation("price", "DEX Screener price", price, "dex-screener", "STRONG_SIGNAL", resolution, "TOKEN", resolution.tokenAddress, "TOKEN"));
  if (liquidity && pool) observations.push(observation("liquidity", "DEX Screener pool liquidity", liquidity, "dex-screener", "STRONG_SIGNAL", resolution, "POOL", pool, "POOL"));
  if (volume && pool) observations.push(observation("volume", "DEX Screener 24h volume", volume, "dex-screener", "STRONG_SIGNAL", resolution, "POOL", pool, "POOL"));
  if (transactionCount && pool) observations.push(observation("transactions", "DEX Screener 24h transactions", transactionCount, "dex-screener", "STRONG_SIGNAL", resolution, "POOL", pool, "POOL"));
  const marketCap = decimal(pair.marketCap); if (marketCap) observations.push(observation("marketCap", "DEX Screener market cap", marketCap, "dex-screener", "STRONG_SIGNAL", resolution, "TOKEN", resolution.tokenAddress, "TOKEN"));
  const fdv = decimal(pair.fdv); if (fdv) observations.push(observation("fdv", "DEX Screener FDV", fdv, "dex-screener", "STRONG_SIGNAL", resolution, "TOKEN", resolution.tokenAddress, "TOKEN"));
  if (pool && pair.pairCreatedAt && Number.isSafeInteger(Number(pair.pairCreatedAt))) observations.push(observation("poolAge", "DEX Screener pool creation time", integer(pair.pairCreatedAt)!, "dex-screener", "STRONG_SIGNAL", resolution, "POOL", pool, "POOL"));
  if (pool) observations.push(observation("pool", "DEX Screener primary pool", pool, "dex-screener", "STRONG_SIGNAL", resolution, "POOL", pool, "POOL"));
  for (const item of observations.slice(start)) {
    item.context!.scope = pool ? "PAIR" : "UNKNOWN_SCOPE";
    item.context!.poolId = pool;
    item.context!.quoteAsset = canonicalAddress(resolution.chain, (pair.quoteToken as JsonRecord | undefined)?.address);
    item.context!.timeWindow = ["volume", "transactions"].includes(item.key) ? "ROLLING_24H" : null;
    item.context!.methodology = "DEX_SCREENER_PAIR";
  }
}

async function fetchBirdeye(chain: string, token: string, usage: AnalyzerProviderUsage[]) {
  const key = process.env.BIRDEYE_API_KEY; if (!key || chain !== "solana") return null;
  return jsonRequest(`https://public-api.birdeye.so/defi/token_overview?address=${encodeURIComponent(token)}`, { headers: { accept: "application/json", "X-API-KEY": key, "x-chain": "solana" } }, "birdeye", "MARKET", usage);
}
function addBirdeyeObservations(payload: JsonRecord | null, resolution: AnalyzerResolution, observations: AnalyzerObservation[]) {
  const data = payload?.data && typeof payload.data === "object" ? payload.data as JsonRecord : null; if (!data || !resolution.tokenAddress) return;
  if (data.address !== undefined && canonicalAddress(resolution.chain, data.address) !== resolution.tokenAddress) throw new ProviderIdentityError();
  const start = observations.length;
  const price = decimal(data.price); if (price) observations.push(observation("price", "Birdeye token price", price, "birdeye", "STRONG_SIGNAL", resolution, "TOKEN", resolution.tokenAddress, "TOKEN"));
  const liquidity = decimal(data.liquidity); const pool = resolution.tokenAddress; if (liquidity && pool) observations.push(observation("liquidity", "Birdeye token liquidity", liquidity, "birdeye", "STRONG_SIGNAL", resolution, "TOKEN", pool, "TOKEN"));
  const volume = decimal(data.volume24h); if (volume && pool) observations.push(observation("volume", "Birdeye 24h volume", volume, "birdeye", "STRONG_SIGNAL", resolution, "TOKEN", pool, "TOKEN"));
  const tx = integer(data.trade24h); if (tx && pool) observations.push(observation("transactions", "Birdeye 24h trades", tx, "birdeye", "STRONG_SIGNAL", resolution, "TOKEN", pool, "TOKEN"));
  for (const item of observations.slice(start)) {
    item.context!.scope = "TOKEN_AGGREGATE"; item.context!.poolId = null;
    item.context!.timeWindow = ["volume", "transactions"].includes(item.key) ? "ROLLING_24H" : null;
    item.context!.methodology = "BIRDEYE_TOKEN_OVERVIEW";
  }
}

export function compareMarketObservations(observations: AnalyzerObservation[]): AnalyzerProviderConflict[] {
  const conflicts: AnalyzerProviderConflict[] = [];
  for (const key of ["price", "liquidity", "marketCap", "fdv", "volume"]) {
    const rows = observations.filter((o) => o.key === key && o.state === "AVAILABLE");
    for (let i = 0; i < rows.length; i++) for (const right of rows.slice(i + 1)) {
      const left = rows[i], a = left.context, b = right.context;
      if (!a || !b || left.source === right.source) continue;
      let cause: string | null = null;
      if (a.scope === "UNKNOWN_SCOPE" || b.scope === "UNKNOWN_SCOPE" || !a.methodology || !b.methodology) cause = "UNRESOLVED";
      else if (a.scope !== b.scope) cause = a.scope === "TOKEN_AGGREGATE" || b.scope === "TOKEN_AGGREGATE" ? "AGGREGATED_VS_SINGLE_POOL" : "METHODOLOGY_DIFFERENCE";
      else if (a.poolId !== b.poolId) cause = "DIFFERENT_PRIMARY_POOL";
      else if (a.quoteAsset !== b.quoteAsset) cause = "QUOTE_ASSET_MISMATCH";
      else if (a.timeWindow !== b.timeWindow || a.methodology !== b.methodology || left.observedAt !== right.observedAt) cause = "METHODOLOGY_DIFFERENCE";
      conflicts.push({ capability: key, providers: [left.source, right.source], state: cause ? "MISSING" : left.value === right.value ? "AGREEMENT" : "DISAGREEMENT", explanation: `${cause ?? "SAME_POOL_DIFFERENT_VALUE"}: ${left.source}=${left.value}; ${right.source}=${right.value}. ${cause ? "Not numerically comparable; scope/time/methodology preserved." : "Comparable observations retained without averaging."}`, evidenceRefs: [left.evidenceId, right.evidenceId] });
    }
  }
  return conflicts;
}

async function solanaEvidence(resolution: AnalyzerResolution, observations: AnalyzerObservation[], usage: AnalyzerProviderUsage[], statuses: AnalyzerCapabilityStatus[]) {
  if (!resolution.tokenAddress || resolution.chain !== "solana") return;
  const apiKey = process.env.HELIUS_API_KEY; const rpcUrl = process.env.SOLANA_RPC_URL; if (!apiKey && !rpcUrl) { statuses.push(status("helius", "TOKEN_IDENTITY", "NOT_CONFIGURED")); return; }
  // Shared Radar contract: request returns the FULL JSON-RPC envelope.
  const request = async (method: string, params: readonly unknown[]) => {
    const endpoint = rpcUrl ?? `https://mainnet.helius-rpc.com/?api-key=${encodeURIComponent(apiKey!)}`;
    return await jsonRequest(endpoint, { method: "POST", headers: { "content-type": "application/json" }, body: JSON.stringify({ jsonrpc: "2.0", id: 1, method, params }) }, "helius", method, usage) ?? { error: { message: "RPC response unavailable" } };
  };
  const account = await request("getAccountInfo", [resolution.tokenAddress, { encoding: "base64", commitment: "confirmed" }]);
  const rawAccount = (account.result as JsonRecord | undefined)?.value as JsonRecord | undefined;
  const mint = verifySolanaMint(rawAccount);
  const ownerIsString = rawAccount !== undefined && typeof rawAccount.owner === "string";
  const ownerIsApproved = ownerIsString && [TOKEN_PROGRAM, TOKEN_2022_PROGRAM].includes(rawAccount.owner as string);
  statuses.push(status("helius", "SOLANA_ADDRESS_VALID", "SUPPORTED"), status("helius", "ACCOUNT_EXISTS", rawAccount ? "SUPPORTED" : "TEMPORARILY_UNAVAILABLE"), status("helius", "TOKEN_PROGRAM_OWNED", ownerIsApproved ? "SUPPORTED" : "TEMPORARILY_UNAVAILABLE"), status("helius", "MINT_ACCOUNT_VERIFIED", mint ? "SUPPORTED" : "TEMPORARILY_UNAVAILABLE"), status("helius", "MINT_FIELDS_DECODED", mint ? "SUPPORTED" : "TEMPORARILY_UNAVAILABLE"));
  if (!mint) { statuses.push(status("helius", "TOKEN_IDENTITY", "TEMPORARILY_UNAVAILABLE"), status("helius", "AUTHORITIES", "TEMPORARILY_UNAVAILABLE")); return; } // Never override a non-mint account with token RPCs.
  const start = observations.length;
  observations.push(observation("supply", "Verified Mint raw total supply", mint.supply, "helius", "VERIFIED_DATA", resolution, "TOKEN", resolution.tokenAddress, "TOKEN"));
  observations.push(observation("decimals", "Verified Mint decimals", mint.decimals, "helius", "VERIFIED_DATA", resolution, "TOKEN", resolution.tokenAddress, "TOKEN"));
  for (const [key, option, offset] of [["mintAuthority", 0, 4], ["freezeAuthority", 46, 50]] as const) {
    if (mint.bytes.readUInt32LE(option) === 1) observations.push(observation(key, key, base58Encode(mint.bytes.subarray(offset, offset + 32)), "helius", "VERIFIED_DATA", resolution, "TOKEN", resolution.tokenAddress, "TOKEN"));
  }
  for (const item of observations.slice(start)) item.context!.tokenProgram = mint.tokenProgram;
  const largest = await request("getTokenLargestAccounts", [resolution.tokenAddress, { commitment: "confirmed" }]);
  const rows = (largest.result as JsonRecord | undefined)?.value;
  const balances = Array.isArray(rows) ? rows.filter((r) => r && canonicalAddress("solana", r.address) && integer(r.amount) !== null).map((r) => ({ address: String(r.address), balance: String(r.amount) })) : [];
  const unique = new Set(balances.map((r) => r.address));
  const value = Array.isArray(rows) && rows.length === balances.length && balances.length <= 20 && unique.size === balances.length && balances.length ? totalSupplyShare(balances, mint.supply) : null;
  if (value !== null) {
    const item = observation("concentration", "TOP10_TOTAL_SUPPLY_SHARE (largest accounts, not holders)", value, "helius", "STRONG_SIGNAL", resolution, "TOKEN", resolution.tokenAddress, "TOKEN");
    Object.assign(item.context!, { classification: "OBJECTIVE_DERIVED", completeness: "PARTIAL", methodology: "TOP10_TOTAL_SUPPLY_SHARE", denominatorType: "TOTAL_SUPPLY", denominatorValue: mint.supply, returnedAccountCount: balances.length, requestedTopN: 20, metricTopN: 10, exclusions: [], rawBalances: balances, tokenProgram: mint.tokenProgram });
    observations.push(item);
  }
  const lifecycle = await collectPumpLifecycle({ mint: resolution.tokenAddress, request: async (method, params) => {
    const envelope = await request(method, params);
    const value = (envelope.result as JsonRecord | undefined)?.value as JsonRecord | undefined;
    const encoded = Array.isArray(value?.data) && value.data[1] === "base64" ? value.data[0] : null;
    const bytes = typeof encoded === "string" ? Buffer.from(encoded, "base64") : Buffer.alloc(0);
    if (value?.owner !== PUMP_PROGRAM_ID || bytes.length < 49 || !bytes.subarray(0, 8).equals(Buffer.from([23,183,248,55,96,216,172,96])) || ![0,1].includes(bytes[48])) return { error: { message: "Pump curve identity unavailable" } };
    return envelope;
  } });
  statuses.push(status("pump", "PUMP_LIFECYCLE", lifecycle.decode.valid ? "SUPPORTED" : "TEMPORARILY_UNAVAILABLE"));
  if (lifecycle.decode.valid) {
    const item = observation("lifecycle", "Verified Pump bonding-curve state", lifecycle.decode.complete.value ? "PUMP_COMPLETED" : "PUMP_BONDING_CURVE_STAGE", "helius", "VERIFIED_DATA", resolution, "TOKEN", resolution.tokenAddress, "TOKEN");
    Object.assign(item.context!, { scope: "BONDING_CURVE", curveAddress: lifecycle.bondingCurveAddress, tokenProgram: PUMP_PROGRAM_ID, decoderVersion: "radar-pump-bonding-curve-v1", complete: lifecycle.decode.complete.value, virtualTokenReserves: lifecycle.decode.virtualTokenReserves.value, virtualSolReserves: lifecycle.decode.virtualSolReserves.value, realTokenReserves: lifecycle.decode.realTokenReserves.value, realSolReserves: lifecycle.decode.realSolReserves.value });
    observations.push(item);
  }
  statuses.push(status("helius", "TOKEN_IDENTITY", "SUPPORTED"), status("helius", "AUTHORITIES", "SUPPORTED"), status("helius", "DISTRIBUTION", value !== null ? "SUPPORTED" : "TEMPORARILY_UNAVAILABLE"));
}

async function evmEvidence(resolution: AnalyzerResolution, observations: AnalyzerObservation[], usage: AnalyzerProviderUsage[], statuses: AnalyzerCapabilityStatus[]) {
  if (!resolution.tokenAddress || !["ethereum", "base", "bnb"].includes(resolution.chain)) return;
  const key = process.env.ALCHEMY_API_KEY; if (!key) { statuses.push(status("alchemy", "TOKEN_IDENTITY", "NOT_CONFIGURED")); return; }
  const network = ({ ethereum: "eth-mainnet", base: "base-mainnet", bnb: "bnb-mainnet" } as Record<string, string>)[resolution.chain]; const endpoint = `https://${network}.g.alchemy.com/v2/${encodeURIComponent(key)}`;
  const rpc = async (method: string, params: unknown[]) => jsonRequest(endpoint, { method: "POST", headers: { "content-type": "application/json", accept: "application/json" }, body: JSON.stringify({ jsonrpc: "2.0", id: 1, method, params }) }, "alchemy", method, usage);
  const code = await rpc("eth_getCode", [resolution.tokenAddress, "latest"]); const supply = await rpc("eth_call", [{ to: resolution.tokenAddress, data: "0x18160ddd" }, "latest"]); const decimals = await rpc("eth_call", [{ to: resolution.tokenAddress, data: "0x313ce567" }, "latest"]); const owner = await rpc("eth_call", [{ to: resolution.tokenAddress, data: "0x8da5cb5b" }, "latest"]);
  const codeValue = typeof code?.result === "string" && /^0x(?:[0-9a-fA-F]{2})+$/.test(code.result) ? code.result : null; const supplyHex = typeof supply?.result === "string" ? supply.result : null; const decimalsHex = typeof decimals?.result === "string" ? decimals.result : null; const ownerHex = typeof owner?.result === "string" ? owner.result : null;
  if (codeValue && codeValue !== "0x") statuses.push(status("alchemy", "TOKEN_IDENTITY", "SUPPORTED")); else statuses.push(status("alchemy", "TOKEN_IDENTITY", "TEMPORARILY_UNAVAILABLE"));
  if (codeValue && codeValue !== "0x" && supplyHex && /^0x[0-9a-fA-F]{64}$/.test(supplyHex)) observations.push(observation("supply", "EVM total supply", BigInt(supplyHex).toString(), "alchemy", "VERIFIED_DATA", resolution, "TOKEN", resolution.tokenAddress, "TOKEN"));
  if (codeValue && codeValue !== "0x" && decimalsHex && /^0x[0-9a-fA-F]{64}$/.test(decimalsHex) && BigInt(decimalsHex) <= BigInt(255)) observations.push(observation("decimals", "EVM token decimals", BigInt(decimalsHex).toString(), "alchemy", "VERIFIED_DATA", resolution, "TOKEN", resolution.tokenAddress, "TOKEN"));
  const ownerAddress = ownerHex && /^0x0{24}[0-9a-fA-F]{40}$/.test(ownerHex) ? evmAddress(`0x${ownerHex.slice(-40)}`) : null;
  if (codeValue && codeValue !== "0x" && ownerAddress && ownerAddress !== "0x0000000000000000000000000000000000000000") observations.push(observation("owner", "EVM owner (not necessarily deployer)", ownerAddress, "alchemy", "VERIFIED_DATA", resolution, "WALLET", ownerAddress, "WALLET"));
  statuses.push(status("alchemy", "AUTHORITIES", ownerAddress ? "SUPPORTED" : "TEMPORARILY_UNAVAILABLE"), status("alchemy", "CREATOR", "UNSUPPORTED"));
}

function configuredStatuses(resolution: AnalyzerResolution): AnalyzerCapabilityStatus[] {
  const result: AnalyzerCapabilityStatus[] = [];
  result.push(status("dex-screener", "MARKET", "SUPPORTED"), status("dex-screener", "LIQUIDITY", "SUPPORTED"), status("dex-screener", "ACTIVITY", "SUPPORTED"));
  result.push(status("helius", "TOKEN_IDENTITY", resolution.chain === "solana" && (configured("HELIUS_API_KEY") || configured("SOLANA_RPC_URL")) ? "SUPPORTED" : resolution.chain === "solana" ? "NOT_CONFIGURED" : "UNSUPPORTED"));
  result.push(status("birdeye", "MARKET", resolution.chain === "solana" && configured("BIRDEYE_API_KEY") ? "SUPPORTED" : resolution.chain === "solana" ? "NOT_CONFIGURED" : "UNSUPPORTED"));
  result.push(status("coingecko", "MARKET", "UNSUPPORTED"));
  result.push(status("gmgn", "CONTEXTUAL_ENRICHMENT", "UNSUPPORTED"));
  result.push(status("alchemy", "TOKEN_IDENTITY", ["ethereum", "base", "bnb"].includes(resolution.chain) && configured("ALCHEMY_API_KEY") ? "SUPPORTED" : ["ethereum", "base", "bnb"].includes(resolution.chain) ? "NOT_CONFIGURED" : "UNSUPPORTED"));
  return result;
}

/** Syntax-only identity for durable reservation; this function performs no IO. */
export function initialLiveResolution(input: AnalyzerInput): AnalyzerResolution {
  const resolution = resolveAnalyzerInput(input);
  if (resolution.inputType === "TOKEN_MINT" && resolution.chain === "unknown" && (!input.hintChain || input.hintChain === "unknown")) return { ...resolution, chain: "solana", canonicalTokenId: `solana:${resolution.tokenAddress}` };
  return resolution;
}
export async function prepareLiveAnalyzerResolution(input: AnalyzerInput, reserved?: AnalyzerResolution): Promise<LivePreparedResolution> {
  let resolution = reserved ?? initialLiveResolution(input);
  const usage: AnalyzerProviderUsage[] = [], statuses = configuredStatuses(resolution);
  if (!["TOKEN_MINT", "CONTRACT_ADDRESS", "DEX_URL", "CHART_URL"].includes(resolution.inputType) || resolution.chain === "unknown" || (!resolution.tokenAddress && !resolution.pairAddress && !resolution.poolAddress)) throw new ProviderIdentityError();
  if ([resolution.tokenAddress, resolution.pairAddress, resolution.poolAddress].some((address) => address !== null && canonicalAddress(resolution.chain, address) !== address)) throw new ProviderIdentityError();
  const seedMarket = await fetchDexMarket(resolution.chain, resolution.tokenAddress, resolution.pairAddress ?? resolution.poolAddress, usage);
  if (!resolution.tokenAddress && seedMarket) {
    const token = canonicalAddress(resolution.chain, (seedMarket.pair.baseToken as JsonRecord)?.address)!;
    const quote = canonicalAddress(resolution.chain, (seedMarket.pair.quoteToken as JsonRecord)?.address)!;
    const trustedPoolIds = seedMarket.pairs.map((candidate) => canonicalAddress(resolution.chain, candidate.pairAddress)).filter((candidate): candidate is string => candidate !== null);
    resolution = { ...resolution, tokenAddress: token, canonicalTokenId: `${resolution.chain}:${token}`, confidence: "PARTIAL", resolvedBaseToken: token, resolvedQuoteToken: quote, trustedPoolIds: [...new Set(trustedPoolIds)] };
  } else if (seedMarket && resolution.tokenAddress) {
    const trustedPoolIds = seedMarket.pairs.map((candidate) => canonicalAddress(resolution.chain, candidate.pairAddress)).filter((candidate): candidate is string => candidate !== null);
    const matchingPair = seedMarket.pairs.find((candidate) => canonicalAddress(resolution.chain, (candidate.baseToken as JsonRecord)?.address) === resolution.tokenAddress);
    const resolvedQuoteToken = canonicalAddress(resolution.chain, (matchingPair?.quoteToken as JsonRecord)?.address);
    resolution = { ...resolution, resolvedBaseToken: resolution.tokenAddress, resolvedQuoteToken: resolvedQuoteToken ?? resolution.resolvedQuoteToken, trustedPoolIds: [...new Set([...(resolution.trustedPoolIds ?? []), ...trustedPoolIds])] };
  }
  return { resolution, seedMarket, usage, statuses };
}

export async function collectLiveAnalyzerEvidence(input: AnalyzerInput, prepared: LivePreparedResolution): Promise<LiveCollection> {
  const observations: AnalyzerObservation[] = []; const usage = [...prepared.usage]; const statuses = [...prepared.statuses]; const resolution = prepared.resolution;
  addDexObservations(prepared.seedMarket, resolution, observations);
  if (resolution.chain === "solana" && resolution.tokenAddress) addBirdeyeObservations(await fetchBirdeye(resolution.chain, resolution.tokenAddress, usage), resolution, observations);
  await solanaEvidence(resolution, observations, usage, statuses); await evmEvidence(resolution, observations, usage, statuses);
  const conflicts = compareMarketObservations(observations);
  const manifest = createEvidenceManifest(input, resolution, observations, [], now(), undefined, conflicts);
  return { manifest, usage, statuses };
}

export function cacheUsageForRepeat(usage: AnalyzerProviderUsage[]): AnalyzerProviderUsage[] { return usage.map((item) => ({ ...item, status: "CACHE_HIT", cache: "HIT", attempts: 0, latencyMs: 0 })); }
