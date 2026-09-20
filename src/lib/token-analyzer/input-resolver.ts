import { isValidSolanaPublicKey } from "@/lib/radar/acceptance/solana";
import { ANALYZER_INPUT_TYPES, type AnalyzerChain, type AnalyzerInput, type AnalyzerInputType, type AnalyzerResolution } from "./contracts";

const EVM = /^0x[0-9a-fA-F]{40}$/;
const CHAIN_ALIASES: Record<string, AnalyzerChain> = { eth: "ethereum", ethereum: "ethereum", base: "base", bsc: "bnb", bnb: "bnb", solana: "solana", sol: "solana" };
const CHAINS = new Set<AnalyzerChain>(["solana", "ethereum", "base", "bnb"]);
const now = () => new Date().toISOString();
function isAnalyzerChain(value: unknown): value is AnalyzerChain { return typeof value === "string" && CHAINS.has(value as AnalyzerChain); }
function normalizeAddress(chain: AnalyzerChain, value: string) {
  return chain === "solana" || (chain === "unknown" && isValidSolanaPublicKey(value)) ? value : value.toLowerCase();
}
function base(inputType: AnalyzerInputType, source: string, chain: AnalyzerChain, tokenAddress: string | null, pairAddress: string | null, poolAddress: string | null, reference: string, confidence: AnalyzerResolution["confidence"] = "UNKNOWN"): AnalyzerResolution {
  const capturedAt = now(); const normalizedToken = tokenAddress ? normalizeAddress(chain, tokenAddress) : null;
  const provenance = [{ source, kind: source === "direct-input" ? "DIRECT_INPUT" as const : "URL_STRUCTURE" as const, reference, capturedAt }];
  return { inputType, source, chain, tokenAddress: normalizedToken, canonicalTokenId: normalizedToken && CHAINS.has(chain) ? `${chain}:${normalizedToken}` : null, pairAddress: pairAddress ? normalizeAddress(chain, pairAddress) : null, poolAddress: poolAddress ? normalizeAddress(chain, poolAddress) : null, symbol: null, name: null, decimals: null, supply: null, launchpad: null, creator: null, creationTimestamp: null, programOrContract: null, confidence, provenance };
}
function identifyAddress(raw: string, hintChain?: AnalyzerChain): AnalyzerResolution | null {
  if (EVM.test(raw)) { const chain = hintChain && isAnalyzerChain(hintChain) && hintChain !== "solana" ? hintChain : "unknown"; return base("CONTRACT_ADDRESS", "direct-input", chain, raw, null, null, raw, "CANDIDATE_IDENTITY"); }
  if (isValidSolanaPublicKey(raw)) { const chain = hintChain === "solana" ? "solana" : "unknown"; return base("TOKEN_MINT", "direct-input", chain, raw, null, null, raw, "CANDIDATE_IDENTITY"); }
  return null;
}
function providerHost(host: string, root: string) { return host === root || host === `www.${root}`; }
function urlResolution(raw: string, url: URL): AnalyzerResolution {
  const host = url.hostname.toLowerCase(); const parts = url.pathname.split("/").filter(Boolean);
  const pathChain = CHAIN_ALIASES[parts[0]?.toLowerCase() ?? ""]; const queryValue = url.searchParams.get("chain")?.toLowerCase(); const queryChain = queryValue ? CHAIN_ALIASES[queryValue] : undefined;
  if (queryValue && !queryChain) return base("UNKNOWN", host, "unknown", null, null, null, raw);
  if (pathChain && queryChain && pathChain !== queryChain) return base("UNKNOWN", host, "unknown", null, null, null, raw);
  const chain = queryChain ?? pathChain ?? "unknown"; const isDex = providerHost(host, "dexscreener.com"); const isBirdeye = providerHost(host, "birdeye.so"); const isGmgn = providerHost(host, "gmgn.ai"); const isGecko = providerHost(host, "geckoterminal.com");
  if ((isDex || isBirdeye || isGmgn || isGecko) && (url.port || url.username || url.password || url.searchParams.getAll("chain").length > 1
    || (isDex && !(parts.length === 2 && pathChain))
    || (isBirdeye && !(parts.length === 2 && parts[0] === "token" && queryChain))
    || (isGmgn && !(parts.length === 3 && pathChain && parts[1] === "token"))
    || (isGecko && !(parts.length === 3 && pathChain && parts[1] === "pools")))) return base("UNKNOWN", host, "unknown", null, null, null, raw);
  const pool = isGecko && parts.includes("pools") ? parts[parts.indexOf("pools") + 1] ?? null : null; const pair = isDex ? parts[1] ?? null : null;
  const tokenMarker = parts.indexOf("token") >= 0 ? parts.indexOf("token") : parts.indexOf("tokens");
  const tokenCandidate = tokenMarker >= 0 ? parts[tokenMarker + 1] ?? null : null;
  const token = (isBirdeye || isGmgn) && tokenCandidate && (chain === "solana" ? isValidSolanaPublicKey(tokenCandidate) : ["ethereum", "base", "bnb"].includes(chain) ? EVM.test(tokenCandidate) : false) ? tokenCandidate : null;
  const articleHost = host === "medium.com" || host.endsWith(".medium.com") || host === "substack.com" || host.endsWith(".substack.com") || host === "mirror.xyz" || host.endsWith(".mirror.xyz");
  const type: AnalyzerInputType = isDex || isBirdeye || isGmgn || isGecko ? (isDex || isGecko ? "DEX_URL" : "CHART_URL") : host === "x.com" || host.endsWith(".x.com") || host === "twitter.com" || host.endsWith(".twitter.com") ? "X_POST" : host === "facebook.com" || host.endsWith(".facebook.com") ? "FACEBOOK_POST" : host === "instagram.com" || host.endsWith(".instagram.com") ? "INSTAGRAM_POST" : articleHost ? "ARTICLE" : "GENERIC_URL";
  const result = base(type, host.replace(/^www\./, ""), chain, token, pair, pool, raw, token || pair || pool ? "PARTIAL" : "UNKNOWN");
  if ((pair && !EVM.test(pair) && !isValidSolanaPublicKey(pair)) || (pool && !EVM.test(pool) && !isValidSolanaPublicKey(pool))) result.confidence = "UNKNOWN";
  return result;
}

export function classifyAnalyzerInput(raw: string): AnalyzerInputType {
  const value = raw.trim();
  if (EVM.test(value)) return "CONTRACT_ADDRESS";
  if (isValidSolanaPublicKey(value)) return "TOKEN_MINT";
  try { const url = new URL(value); if (!/^https?:$/.test(url.protocol)) return "UNKNOWN"; return urlResolution(value, url).inputType; } catch { return "UNKNOWN"; }
}

export function resolveAnalyzerInput(input: AnalyzerInput): AnalyzerResolution {
  const raw = input.raw.trim();
  if (raw.length === 0 || raw.length > 4096) return base("UNKNOWN", "direct-input", "unknown", null, null, null, "");
  const hintChain = isAnalyzerChain(input.hintChain) ? input.hintChain : undefined;
  const address = identifyAddress(raw, hintChain);
  if (address) return address;
  try { const url = new URL(raw); if (!/^https?:$/.test(url.protocol) || url.username || url.password) return base("UNKNOWN", "direct-input", "unknown", null, null, null, raw); const result = urlResolution(raw, url); if (hintChain && result.chain !== hintChain) return base("UNKNOWN", result.source, "unknown", null, null, null, raw); return result; } catch { return base("UNKNOWN", "direct-input", "unknown", null, null, null, raw); }
}

export function isSupportedAnalyzerInputType(value: unknown): value is AnalyzerInputType { return typeof value === "string" && (ANALYZER_INPUT_TYPES as readonly string[]).includes(value); }
