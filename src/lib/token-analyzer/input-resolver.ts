import { ANALYZER_INPUT_TYPES, type AnalyzerChain, type AnalyzerInput, type AnalyzerInputType, type AnalyzerResolution } from "./contracts";

const EVM = /^0x[a-fA-F0-9]{40}$/;
const SOLANA = /^[1-9A-HJ-NP-Za-km-z]{32,44}$/;
const CHAIN_ALIASES: Record<string, AnalyzerChain> = { eth: "ethereum", ethereum: "ethereum", base: "base", bsc: "bnb", bnb: "bnb", solana: "solana", sol: "solana" };
const now = () => new Date().toISOString();

function base(inputType: AnalyzerInputType, source: string, chain: AnalyzerChain, tokenAddress: string | null, pairAddress: string | null, poolAddress: string | null, reference: string): AnalyzerResolution {
  const capturedAt = now();
  const provenance = [{ source, kind: source === "direct-input" ? "DIRECT_INPUT" as const : "URL_STRUCTURE" as const, reference, capturedAt }];
  return { inputType, source, chain, tokenAddress, canonicalTokenId: tokenAddress ? `${chain}:${tokenAddress.toLowerCase()}` : null, pairAddress, poolAddress, symbol: null, name: null, decimals: null, supply: null, launchpad: null, creator: null, creationTimestamp: null, programOrContract: null, confidence: tokenAddress ? "RESOLVED" : "UNKNOWN", provenance };
}

function identifyAddress(raw: string, hintChain?: AnalyzerChain): AnalyzerResolution | null {
  if (EVM.test(raw)) return base("CONTRACT_ADDRESS", "direct-input", hintChain && hintChain !== "solana" ? hintChain : "unknown", raw, null, null, raw);
  if (SOLANA.test(raw)) return base("TOKEN_MINT", "direct-input", hintChain === "solana" ? "solana" : "unknown", raw, null, null, raw);
  return null;
}

function urlResolution(raw: string, url: URL): AnalyzerResolution {
  const host = url.hostname.toLowerCase();
  const parts = url.pathname.split("/").filter(Boolean);
  const chain = CHAIN_ALIASES[url.searchParams.get("chain")?.toLowerCase() ?? ""] ?? CHAIN_ALIASES[parts[0]?.toLowerCase() ?? ""] ?? "unknown";
  const address = parts.find((part) => EVM.test(part) || SOLANA.test(part)) ?? null;
  const isDex = host.includes("dexscreener.com");
  const isBirdeye = host.includes("birdeye.so");
  const isGmgn = host.includes("gmgn.ai");
  const isGecko = host.includes("geckoterminal.com");
  const pool = isGecko && parts.includes("pools") ? parts[parts.indexOf("pools") + 1] ?? null : null;
  const pair = isDex ? parts[1] ?? null : null;
  const articleHost = host === "medium.com" || host.endsWith(".medium.com") || host === "substack.com" || host.endsWith(".substack.com") || host === "mirror.xyz" || host.endsWith(".mirror.xyz");
  const type: AnalyzerInputType = isDex || isBirdeye || isGmgn || isGecko ? (isDex || isGecko ? "DEX_URL" : "CHART_URL") : host.includes("x.com") || host.includes("twitter.com") ? "X_POST" : host.includes("facebook.com") ? "FACEBOOK_POST" : host.includes("instagram.com") ? "INSTAGRAM_POST" : articleHost ? "ARTICLE" : "GENERIC_URL";
  const result = base(type, host, chain, address, pair, pool, raw);
  if (!address && !pair && !pool && ["DEX_URL", "CHART_URL"].includes(type)) result.confidence = "PARTIAL";
  return result;
}

export function classifyAnalyzerInput(raw: string): AnalyzerInputType {
  const value = raw.trim();
  if (EVM.test(value)) return "CONTRACT_ADDRESS";
  if (SOLANA.test(value)) return "TOKEN_MINT";
  try { const url = new URL(value); if (!/^https?:$/.test(url.protocol)) return "UNKNOWN"; return urlResolution(value, url).inputType; } catch { return "UNKNOWN"; }
}

export function resolveAnalyzerInput(input: AnalyzerInput): AnalyzerResolution {
  const raw = input.raw.trim();
  if (raw.length === 0 || raw.length > 4096) return base("UNKNOWN", "direct-input", "unknown", null, null, null, "");
  const address = identifyAddress(raw, input.hintChain);
  if (address) return address;
  try { const url = new URL(raw); if (!/^https?:$/.test(url.protocol) || url.username || url.password) return base("UNKNOWN", "direct-input", "unknown", null, null, null, raw); return urlResolution(raw, url); } catch { return base("UNKNOWN", "direct-input", "unknown", null, null, null, raw); }
}

export function isSupportedAnalyzerInputType(value: unknown): value is AnalyzerInputType { return typeof value === "string" && (ANALYZER_INPUT_TYPES as readonly string[]).includes(value); }
