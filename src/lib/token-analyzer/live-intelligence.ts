import "server-only";

import { collectPumpLifecycle, HeliusSolanaAcceptanceClient, isValidSolanaPublicKey } from "@/lib/radar/acceptance/solana";
import { deriveHolderConcentration } from "@/lib/radar/acceptance/signal-gaps";
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
function safeError(error: unknown) { return error instanceof Error && error.name === "AbortError" ? "TIMEOUT" : error instanceof Error ? error.name : "PROVIDER_ERROR"; }
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
function ratio(numerator: bigint, denominator: bigint): string | null {
  if (denominator <= BigInt(0)) return null;
  const scale = BigInt(1000000000000);
  const scaled = (numerator * scale) / denominator;
  const whole = scaled / scale;
  const fraction = (scaled % scale).toString().padStart(12, "0").replace(/0+$/, "");
  return fraction ? `${whole}.${fraction}` : whole.toString();
}
function base58Encode(bytes: Uint8Array) { let number = BigInt(0); for (const byte of bytes) number = number * BigInt(256) + BigInt(byte); let output = ""; while (number > BigInt(0)) { output = BASE58[Number(number % BigInt(58))] + output; number /= BigInt(58); } for (const byte of bytes) { if (byte !== 0) break; output = `1${output}`; } return output; }
function evmAddress(value: unknown) { return typeof value === "string" && /^0x[0-9a-fA-F]{40}$/.test(value) ? value.toLowerCase() : null; }
function chainForDex(chain: string) { return DEX_CHAIN[chain] ?? chain; }

async function jsonRequest(url: string, init: RequestInit, provider: string, capability: string, usage: AnalyzerProviderUsage[]): Promise<JsonRecord | null> {
  let lastError: string | null = null;
  for (let attempt = 0; attempt <= RETRIES; attempt += 1) {
    const started = Date.now(); const controller = new AbortController(); const timer = setTimeout(() => controller.abort(), TIMEOUT_MS);
    try {
      const response = await fetch(url, { ...init, signal: controller.signal });
      const text = await response.text();
      let payload: JsonRecord = {};
      try { payload = text ? JSON.parse(text) as JsonRecord : {}; } catch { payload = {}; }
      const limited = response.status === 429;
      if (response.ok && !limited) {
        usage.push({ provider, capability, status: "SUCCESS", latencyMs: Date.now() - started, attempts: attempt + 1, cache: "MISS", error: null });
        return payload;
      }
      lastError = limited ? "RATE_LIMITED" : `HTTP_${response.status}`;
      if ((!limited && response.status < 500) || attempt >= RETRIES) break;
      await new Promise((resolve) => setTimeout(resolve, 250 * (attempt + 1)));
    } catch (error) { lastError = safeError(error); break; }
    finally { clearTimeout(timer); }
  }
  usage.push({ provider, capability, status: lastError === "RATE_LIMITED" ? "RATE_LIMITED" : "FAILED", latencyMs: 0, attempts: RETRIES + 1, cache: "MISS", error: lastError });
  return null;
}

function configured(name: string) { return typeof process.env[name] === "string" && process.env[name]!.trim().length > 0; }
function status(provider: string, capability: string, value: AnalyzerCapabilityStatus["status"]): AnalyzerCapabilityStatus { return { provider, capability, status: value }; }
function observation(key: string, label: string, value: string, source: string, evidenceClass: "VERIFIED_DATA" | "STRONG_SIGNAL", resolution: AnalyzerResolution, identityType: "TOKEN" | "POOL" | "WALLET", identity: string, referenceType: "TOKEN" | "POOL" | "WALLET" | "TRANSACTION", transactionReference?: string): AnalyzerObservation {
  const tokenId = resolution.canonicalTokenId!; const reference = referenceType === "TRANSACTION" ? transactionReference! : identity;
  const result: AnalyzerObservation = { key, label, value, state: "AVAILABLE", evidenceClass, source, observedAt: now(), evidenceId: `${source}:${key}:${identity}:${Date.now()}`, identity, identityType, tokenId, provenance: [{ source, kind: evidenceClass === "VERIFIED_DATA" ? (source === "helius" || source === "solana-rpc" || source === "alchemy" ? "DIRECT_CHAIN" : "OBJECTIVE_PROVIDER") : "PROVIDER_DERIVED", reference, referenceType, capturedAt: now() }] };
  if (transactionReference) result.transactionReference = transactionReference;
  return result;
}

function dexPairs(payload: JsonRecord | null) { return Array.isArray(payload?.pairs) ? payload!.pairs.filter((item): item is JsonRecord => Boolean(item && typeof item === "object")) : []; }
function pairMatches(pair: JsonRecord, chain: string, token: string) { const base = pair.baseToken as JsonRecord | undefined; return pair.chainId === chainForDex(chain) && typeof base?.address === "string" && base.address.toLowerCase() === token.toLowerCase(); }
function selectPair(pairs: JsonRecord[], chain: string, token: string, pairAddress?: string | null) { return pairs.filter((pair) => pairMatches(pair, chain, token) && (!pairAddress || String(pair.pairAddress).toLowerCase() === pairAddress.toLowerCase())).sort((a, b) => Number(((b.liquidity as JsonRecord | undefined)?.usd) ?? 0) - Number(((a.liquidity as JsonRecord | undefined)?.usd) ?? 0))[0] ?? null; }
async function fetchDexMarket(chain: string, token: string | null, pairAddress: string | null, usage: AnalyzerProviderUsage[]): Promise<SeedMarket> {
  if (!token && !pairAddress) return null;
  const path = pairAddress ? `/latest/dex/pairs/${encodeURIComponent(chainForDex(chain))}/${encodeURIComponent(pairAddress)}` : `/latest/dex/tokens/${encodeURIComponent(token!)}`;
  const payload = await jsonRequest(`https://api.dexscreener.com${path}`, { headers: { accept: "application/json" } }, "dex-screener", "MARKET", usage);
  const pairs = dexPairs(payload); const selected = pairAddress ? (pairs[0] ?? null) : selectPair(pairs, chain, token!);
  return selected ? { provider: "dex-screener", pair: selected, pairs } : null;
}
function addDexObservations(seed: SeedMarket, resolution: AnalyzerResolution, observations: AnalyzerObservation[]) {
  if (!seed || !resolution.tokenAddress || !resolution.canonicalTokenId) return;
  const pair = seed.pair; const rawPool = typeof pair.pairAddress === "string" ? pair.pairAddress : null; const pool = rawPool && (resolution.chain === "solana" ? isValidSolanaPublicKey(rawPool) : Boolean(evmAddress(rawPool))) ? rawPool : null;
  const price = decimal(pair.priceUsd); const liquidity = decimal((pair.liquidity as JsonRecord | undefined)?.usd); const volume = decimal((pair.volume as JsonRecord | undefined)?.h24); const txns = (pair.txns as JsonRecord | undefined)?.h24 as JsonRecord | undefined; const transactionCount = integer(Number(txns?.buys ?? 0) + Number(txns?.sells ?? 0));
  if (price) observations.push(observation("price", "DEX Screener price", price, "dex-screener", "STRONG_SIGNAL", resolution, "TOKEN", resolution.tokenAddress, "TOKEN"));
  if (liquidity && pool) observations.push(observation("liquidity", "DEX Screener pool liquidity", liquidity, "dex-screener", "STRONG_SIGNAL", resolution, "POOL", pool, "POOL"));
  if (volume && pool) observations.push(observation("volume", "DEX Screener 24h volume", volume, "dex-screener", "STRONG_SIGNAL", resolution, "POOL", pool, "POOL"));
  if (transactionCount && pool) observations.push(observation("transactions", "DEX Screener 24h transactions", transactionCount, "dex-screener", "STRONG_SIGNAL", resolution, "POOL", pool, "POOL"));
  const marketCap = decimal(pair.marketCap); if (marketCap) observations.push(observation("marketCap", "DEX Screener market cap", marketCap, "dex-screener", "STRONG_SIGNAL", resolution, "TOKEN", resolution.tokenAddress, "TOKEN"));
  const fdv = decimal(pair.fdv); if (fdv) observations.push(observation("fdv", "DEX Screener FDV", fdv, "dex-screener", "STRONG_SIGNAL", resolution, "TOKEN", resolution.tokenAddress, "TOKEN"));
  if (pool && pair.pairCreatedAt && Number.isSafeInteger(Number(pair.pairCreatedAt))) observations.push(observation("poolAge", "DEX Screener pool creation time", integer(pair.pairCreatedAt)!, "dex-screener", "STRONG_SIGNAL", resolution, "POOL", pool, "POOL"));
  if (pool) observations.push(observation("pool", "DEX Screener primary pool", pool, "dex-screener", "STRONG_SIGNAL", resolution, "POOL", pool, "POOL"));
}

async function fetchBirdeye(chain: string, token: string, usage: AnalyzerProviderUsage[]) {
  const key = process.env.BIRDEYE_API_KEY; if (!key || chain !== "solana") return null;
  return jsonRequest(`https://public-api.birdeye.so/defi/token_overview?address=${encodeURIComponent(token)}`, { headers: { accept: "application/json", "X-API-KEY": key, "x-chain": "solana" } }, "birdeye", "MARKET", usage);
}
function addBirdeyeObservations(payload: JsonRecord | null, resolution: AnalyzerResolution, observations: AnalyzerObservation[]) {
  const data = payload?.data && typeof payload.data === "object" ? payload.data as JsonRecord : null; if (!data || !resolution.tokenAddress) return;
  const price = decimal(data.price); if (price) observations.push(observation("price", "Birdeye token price", price, "birdeye", "STRONG_SIGNAL", resolution, "TOKEN", resolution.tokenAddress, "TOKEN"));
  const liquidity = decimal(data.liquidity); const pool = resolution.poolAddress ?? resolution.pairAddress; if (liquidity && pool) observations.push(observation("liquidity", "Birdeye token liquidity", liquidity, "birdeye", "STRONG_SIGNAL", resolution, "POOL", pool, "POOL"));
  const volume = decimal(data.volume24h); if (volume && pool) observations.push(observation("volume", "Birdeye 24h volume", volume, "birdeye", "STRONG_SIGNAL", resolution, "POOL", pool, "POOL"));
  const tx = integer(data.trade24h); if (tx && pool) observations.push(observation("transactions", "Birdeye 24h trades", tx, "birdeye", "STRONG_SIGNAL", resolution, "POOL", pool, "POOL"));
}

function compareMarkets(seed: SeedMarket, observations: AnalyzerObservation[]): AnalyzerProviderConflict[] {
  if (!seed) return [];
  const dexPrice = observations.find((item) => item.key === "price" && item.source === "dex-screener")?.value; const birdeyePrice = observations.find((item) => item.key === "price" && item.source === "birdeye")?.value;
  if (dexPrice === undefined || birdeyePrice === undefined) return [];
  return [{ capability: "MARKET_PRICE", providers: ["birdeye", "dex-screener"], state: dexPrice === birdeyePrice ? "AGREEMENT" : "DISAGREEMENT", explanation: `Birdeye=${String(birdeyePrice)}; DEX Screener=${String(dexPrice)}; pair=${String(seed.pair.pairAddress)}. Values are preserved separately.`, evidenceRefs: observations.filter((item) => item.key === "price").map((item) => item.evidenceId) }];
}

async function solanaEvidence(resolution: AnalyzerResolution, observations: AnalyzerObservation[], usage: AnalyzerProviderUsage[], statuses: AnalyzerCapabilityStatus[]) {
  if (!resolution.tokenAddress || resolution.chain !== "solana") return;
  const apiKey = process.env.HELIUS_API_KEY; const rpcUrl = process.env.SOLANA_RPC_URL; if (!apiKey && !rpcUrl) { statuses.push(status("helius", "TOKEN_IDENTITY", "NOT_CONFIGURED")); return; }
  const client = apiKey ? new HeliusSolanaAcceptanceClient(apiKey) : null;
  const request = async (method: string, params: readonly unknown[]) => {
    const endpoint = rpcUrl ?? `https://mainnet.helius-rpc.com/?api-key=${encodeURIComponent(apiKey!)}`; const payload = await jsonRequest(endpoint, { method: "POST", headers: { "content-type": "application/json", accept: "application/json" }, body: JSON.stringify({ jsonrpc: "2.0", id: 1, method, params }) }, "helius", method, usage); void client; const result = payload?.result; return result && typeof result === "object" ? result as JsonRecord : payload;
  };
  const account = await request("getAccountInfo", [resolution.tokenAddress, { encoding: "base64", commitment: "confirmed" }]);
  const supply = await request("getTokenSupply", [resolution.tokenAddress, { commitment: "confirmed" }]);
  const largest = await request("getTokenLargestAccounts", [resolution.tokenAddress, { commitment: "confirmed" }]);
  const supplyValue = (supply?.value && typeof supply.value === "object" ? supply.value as JsonRecord : null); const supplyAmount = integer(supplyValue?.amount); const decimals = integer(supplyValue?.decimals);
  if (supplyAmount) observations.push(observation("supply", "Solana token supply", supplyAmount, "helius", "VERIFIED_DATA", resolution, "TOKEN", resolution.tokenAddress, "TOKEN"));
  if (decimals) observations.push(observation("decimals", "Solana token decimals", decimals, "helius", "VERIFIED_DATA", resolution, "TOKEN", resolution.tokenAddress, "TOKEN"));
  const accounts = (account?.value && typeof account.value === "object" ? account.value as JsonRecord : null); const encoded = Array.isArray(accounts?.data) ? accounts!.data[0] : null;
  if (typeof encoded === "string") {
    const bytes = Uint8Array.from(Buffer.from(encoded, "base64"));
    if (bytes.length >= 82) {
      const mintOption = bytes[0] === 1; const mint = mintOption ? base58Encode(bytes.slice(4, 36)) : null; const freezeOption = bytes[46] === 1; const freeze = freezeOption ? base58Encode(bytes.slice(50, 82)) : null;
      if (mint) observations.push(observation("mintAuthority", "Solana mint authority", mint, "helius", "VERIFIED_DATA", resolution, "TOKEN", resolution.tokenAddress, "TOKEN"));
      if (freeze) observations.push(observation("freezeAuthority", "Solana freeze authority", freeze, "helius", "VERIFIED_DATA", resolution, "TOKEN", resolution.tokenAddress, "TOKEN"));
    }
  }
  const largestRows = Array.isArray(largest?.value) ? largest!.value.filter((item): item is JsonRecord => Boolean(item && typeof item === "object")) : [];
  if (supplyAmount && largestRows.length) {
    const holderBalances = largestRows.map((row) => ({ address: String(row.address ?? ""), balance: String(row.amount ?? "") })).filter((row) => isValidSolanaPublicKey(row.address) && /^\d+$/.test(row.balance));
    const concentration = deriveHolderConcentration(holderBalances, 10).concentration; const value = concentration ? ratio(BigInt(concentration.numerator), BigInt(concentration.denominator)) : null;
    if (value) observations.push(observation("concentration", "Solana largest-account top-10 concentration", value, "helius", "VERIFIED_DATA", resolution, "TOKEN", resolution.tokenAddress, "TOKEN"));
  }
  try {
    const lifecycle = await collectPumpLifecycle({ mint: resolution.tokenAddress, request: async (method, params) => { const payload = await request(method, params); return payload ?? { error: { message: "RPC response unavailable" } }; } });
    statuses.push(status("pump", "PUMP_LIFECYCLE", lifecycle.decode.valid ? "SUPPORTED" : "TEMPORARILY_UNAVAILABLE"));
    if (lifecycle.decode.valid) observations.push(observation("lifecycle", lifecycle.decode.complete.value ? "Pump bonding curve completed" : "Pump bonding curve active", lifecycle.decode.complete.value ? "PUMP_COMPLETED" : "PUMP_BONDING_CURVE_STAGE", "helius", "VERIFIED_DATA", resolution, "TOKEN", resolution.tokenAddress, "TOKEN"));
  } catch { statuses.push(status("pump", "PUMP_LIFECYCLE", "TEMPORARILY_UNAVAILABLE")); }
  statuses.push(status("helius", "TOKEN_IDENTITY", account ? "SUPPORTED" : "TEMPORARILY_UNAVAILABLE"), status("helius", "AUTHORITIES", account ? "SUPPORTED" : "TEMPORARILY_UNAVAILABLE"), status("helius", "DISTRIBUTION", largestRows.length ? "SUPPORTED" : "TEMPORARILY_UNAVAILABLE"));
}

async function evmEvidence(resolution: AnalyzerResolution, observations: AnalyzerObservation[], usage: AnalyzerProviderUsage[], statuses: AnalyzerCapabilityStatus[]) {
  if (!resolution.tokenAddress || !["ethereum", "base", "bnb"].includes(resolution.chain)) return;
  const key = process.env.ALCHEMY_API_KEY; if (!key) { statuses.push(status("alchemy", "TOKEN_IDENTITY", "NOT_CONFIGURED")); return; }
  const network = ({ ethereum: "eth-mainnet", base: "base-mainnet", bnb: "bnb-mainnet" } as Record<string, string>)[resolution.chain]; const endpoint = `https://${network}.g.alchemy.com/v2/${encodeURIComponent(key)}`;
  const rpc = async (method: string, params: unknown[]) => jsonRequest(endpoint, { method: "POST", headers: { "content-type": "application/json", accept: "application/json" }, body: JSON.stringify({ jsonrpc: "2.0", id: 1, method, params }) }, "alchemy", method, usage);
  const code = await rpc("eth_getCode", [resolution.tokenAddress, "latest"]); const supply = await rpc("eth_call", [{ to: resolution.tokenAddress, data: "0x18160ddd" }, "latest"]); const decimals = await rpc("eth_call", [{ to: resolution.tokenAddress, data: "0x313ce567" }, "latest"]); const owner = await rpc("eth_call", [{ to: resolution.tokenAddress, data: "0x8da5cb5b" }, "latest"]);
  const codeValue = typeof code?.result === "string" ? code.result : null; const supplyHex = typeof supply?.result === "string" ? supply.result : null; const decimalsHex = typeof decimals?.result === "string" ? decimals.result : null; const ownerHex = typeof owner?.result === "string" ? owner.result : null;
  if (codeValue && codeValue !== "0x") statuses.push(status("alchemy", "TOKEN_IDENTITY", "SUPPORTED")); else statuses.push(status("alchemy", "TOKEN_IDENTITY", "TEMPORARILY_UNAVAILABLE"));
  if (supplyHex && /^0x[0-9a-fA-F]+$/.test(supplyHex)) observations.push(observation("supply", "EVM total supply", BigInt(supplyHex).toString(), "alchemy", "VERIFIED_DATA", resolution, "TOKEN", resolution.tokenAddress, "TOKEN"));
  if (decimalsHex && /^0x[0-9a-fA-F]+$/.test(decimalsHex)) observations.push(observation("decimals", "EVM token decimals", BigInt(decimalsHex).toString(), "alchemy", "VERIFIED_DATA", resolution, "TOKEN", resolution.tokenAddress, "TOKEN"));
  const ownerAddress = ownerHex && ownerHex.length >= 42 ? evmAddress(`0x${ownerHex.slice(-40)}`) : null;
  if (ownerAddress && ownerAddress !== "0x0000000000000000000000000000000000000000") observations.push(observation("creator", "EVM owner (not necessarily deployer)", ownerAddress, "alchemy", "VERIFIED_DATA", resolution, "WALLET", ownerAddress, "WALLET"));
  statuses.push(status("alchemy", "AUTHORITIES", ownerAddress ? "SUPPORTED" : "TEMPORARILY_UNAVAILABLE"), status("alchemy", "CREATOR", ownerAddress ? "SUPPORTED" : "TEMPORARILY_UNAVAILABLE"));
}

function configuredStatuses(resolution: AnalyzerResolution): AnalyzerCapabilityStatus[] {
  const result: AnalyzerCapabilityStatus[] = [];
  result.push(status("dex-screener", "MARKET", "SUPPORTED"), status("dex-screener", "LIQUIDITY", "SUPPORTED"), status("dex-screener", "ACTIVITY", "SUPPORTED"));
  result.push(status("helius", "TOKEN_IDENTITY", resolution.chain === "solana" && configured("HELIUS_API_KEY") ? "SUPPORTED" : resolution.chain === "solana" ? "NOT_CONFIGURED" : "UNSUPPORTED"));
  result.push(status("birdeye", "MARKET", resolution.chain === "solana" && configured("BIRDEYE_API_KEY") ? "SUPPORTED" : resolution.chain === "solana" ? "NOT_CONFIGURED" : "UNSUPPORTED"));
  result.push(status("coingecko", "MARKET", configured("COINGECKO_API_KEY") ? "SUPPORTED" : "NOT_CONFIGURED"));
  result.push(status("gmgn", "CONTEXTUAL_ENRICHMENT", resolution.chain === "solana" ? "SUPPORTED" : "UNSUPPORTED"));
  result.push(status("alchemy", "TOKEN_IDENTITY", ["ethereum", "base", "bnb"].includes(resolution.chain) && configured("ALCHEMY_API_KEY") ? "SUPPORTED" : ["ethereum", "base", "bnb"].includes(resolution.chain) ? "NOT_CONFIGURED" : "UNSUPPORTED"));
  return result;
}

export async function prepareLiveAnalyzerResolution(input: AnalyzerInput): Promise<LivePreparedResolution> {
  const initial = resolveAnalyzerInput(input); const usage: AnalyzerProviderUsage[] = []; const statuses = configuredStatuses(initial); let resolution = { ...initial, provenance: [...initial.provenance] };
  if (resolution.inputType === "TOKEN_MINT" && isValidSolanaPublicKey(input.raw.trim()) && resolution.chain === "unknown") resolution = { ...resolution, chain: "solana", canonicalTokenId: `solana:${input.raw.trim()}` };
  let seedMarket: SeedMarket = null;
  if (resolution.chain !== "unknown" && (resolution.tokenAddress || resolution.pairAddress || resolution.poolAddress)) seedMarket = await fetchDexMarket(resolution.chain, resolution.tokenAddress, resolution.pairAddress ?? resolution.poolAddress, usage);
  if (seedMarket?.pair) {
    const pairAddress = resolution.pairAddress ?? (typeof seedMarket.pair.pairAddress === "string" ? seedMarket.pair.pairAddress : null);
    const baseToken = seedMarket.pair.baseToken as JsonRecord | undefined; const resolvedToken = typeof baseToken?.address === "string" ? baseToken.address : resolution.tokenAddress;
    if (resolvedToken && resolution.chain !== "unknown") {
      const normalizedPair = pairAddress ? (resolution.chain === "solana" ? pairAddress : pairAddress.toLowerCase()) : null;
      const normalizedToken = resolution.chain === "solana" ? resolvedToken : resolvedToken.toLowerCase();
      resolution = { ...resolution, tokenAddress: normalizedToken, canonicalTokenId: `${resolution.chain}:${normalizedToken}`, pairAddress: resolution.inputType === "DEX_URL" ? normalizedPair : resolution.pairAddress, poolAddress: resolution.poolAddress, confidence: "PARTIAL", provenance: [...resolution.provenance, { source: "dex-screener", kind: "OBJECTIVE_PROVIDER", reference: normalizedToken, referenceType: "TOKEN", capturedAt: now() }] };
    }
  }
  return { resolution, seedMarket, usage, statuses };
}

export async function collectLiveAnalyzerEvidence(input: AnalyzerInput, prepared: LivePreparedResolution): Promise<LiveCollection> {
  const observations: AnalyzerObservation[] = []; const usage = [...prepared.usage]; const statuses = [...prepared.statuses]; const resolution = prepared.resolution;
  addDexObservations(prepared.seedMarket, resolution, observations);
  if (resolution.chain === "solana" && resolution.tokenAddress) addBirdeyeObservations(await fetchBirdeye(resolution.chain, resolution.tokenAddress, usage), resolution, observations);
  await solanaEvidence(resolution, observations, usage, statuses); await evmEvidence(resolution, observations, usage, statuses);
  const conflicts = compareMarkets(prepared.seedMarket, observations);
  const manifest = createEvidenceManifest(input, resolution, observations, [], now(), undefined, conflicts);
  return { manifest, usage, statuses };
}

export function cacheUsageForRepeat(usage: AnalyzerProviderUsage[]): AnalyzerProviderUsage[] { return usage.map((item) => ({ ...item, status: "CACHE_HIT", cache: "HIT", attempts: 0, latencyMs: 0 })); }
