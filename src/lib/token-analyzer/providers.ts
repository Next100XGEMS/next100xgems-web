import type { AnalyzerChain, AnalyzerObservation, AnalyzerResolution } from "./contracts";

export const ANALYZER_PROVIDER_CAPABILITIES = ["TOKEN_IDENTITY", "MARKET", "LIQUIDITY", "HOLDERS", "DISTRIBUTION", "CREATOR", "ACTIVITY", "AUTHORITIES", "TOP_TRADES", "SOCIAL_CONTEXT"] as const;
export type AnalyzerProviderCapability = (typeof ANALYZER_PROVIDER_CAPABILITIES)[number];
export type AnalyzerProviderResult = { provider: string; capability: AnalyzerProviderCapability; observations: AnalyzerObservation[] };
export type AnalyzerProviderAdapter = { provider: string; chains: readonly AnalyzerChain[]; capabilities: readonly AnalyzerProviderCapability[]; observe(resolution: AnalyzerResolution, capabilities: readonly AnalyzerProviderCapability[]): Promise<AnalyzerProviderResult> };

export const ANALYZER_PROVIDER_REGISTRY = Object.freeze([
  { provider: "helius", chains: ["solana"] as const, capabilities: ["TOKEN_IDENTITY", "HOLDERS", "DISTRIBUTION", "CREATOR", "ACTIVITY", "AUTHORITIES"] as const },
  { provider: "pump", chains: ["solana"] as const, capabilities: ["TOKEN_IDENTITY", "CREATOR", "AUTHORITIES", "LIQUIDITY"] as const },
  { provider: "birdeye", chains: ["solana"] as const, capabilities: ["TOKEN_IDENTITY", "MARKET", "LIQUIDITY", "HOLDERS", "DISTRIBUTION", "ACTIVITY", "TOP_TRADES"] as const },
  { provider: "dex-screener", chains: ["solana", "ethereum", "base", "bnb"] as const, capabilities: ["MARKET", "LIQUIDITY", "ACTIVITY"] as const },
  { provider: "coingecko", chains: ["solana", "ethereum", "base", "bnb"] as const, capabilities: ["MARKET", "LIQUIDITY", "ACTIVITY"] as const },
  { provider: "gmgn", chains: ["solana"] as const, capabilities: ["MARKET", "HOLDERS", "CREATOR", "SOCIAL_CONTEXT"] as const },
  { provider: "alchemy", chains: ["ethereum", "base", "bnb"] as const, capabilities: ["TOKEN_IDENTITY", "AUTHORITIES", "CREATOR", "ACTIVITY"] as const },
] as const);

export function providerCandidates(resolution: AnalyzerResolution, capability: AnalyzerProviderCapability) {
  return ANALYZER_PROVIDER_REGISTRY.filter((item) => item.chains.includes(resolution.chain as never) && item.capabilities.includes(capability as never)).map((item) => item.provider);
}
