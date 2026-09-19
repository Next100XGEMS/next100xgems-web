import { normalizeProviderObservation, type RadarNormalizationContext } from "@/lib/radar/normalization";
import { sanitizeRadarProviderError } from "@/lib/radar/errors";
import type { AcceptanceCapability, AcceptanceChain, AcceptanceCollectionRecord, AcceptanceProbeRequest, AcceptanceProviderAdapter, AcceptanceSample, AcceptanceTier } from "@/lib/radar/acceptance/contracts";
import { AcceptanceTelemetryStore } from "@/lib/radar/acceptance/telemetry";

export type ChainAcceptancePlan = { chain: AcceptanceChain; tier: AcceptanceTier; commonCapabilities: readonly AcceptanceCapability[]; chainSpecificCapabilities: readonly AcceptanceCapability[]; providers: readonly string[] };

const A_COMMON: readonly AcceptanceCapability[] = ["TOKEN_IDENTITY", "MARKET_PAIR", "PRICE", "LIQUIDITY", "VOLUME", "TRADES", "HOLDERS", "TOP_HOLDERS", "TOKEN_CREATOR", "ACTIVITY", "COVERAGE_LINEAGE"];
const PLAN_OVERRIDES: Record<AcceptanceChain, { tier: AcceptanceTier; specific: readonly AcceptanceCapability[]; providers: readonly string[] }> = {
  solana: { tier: "A_DEEP", specific: ["TOKEN_AUTHORITIES", "TOKEN_SUPPLY", "TOKEN_TRANSFERS", "POOL_STATE", "LAUNCHPAD_LIFECYCLE", "OHLCV", "CREATOR_HISTORY", "TOKEN_SECURITY"], providers: ["pump-program", "helius", "birdeye", "gmgn", "coingecko", "dex-screener"] },
  bnb: { tier: "A_DEEP", specific: ["TOKEN_METADATA", "CONTRACT_STATE", "POOL_STATE", "LP_STATE", "OHLCV", "TOKEN_SECURITY"], providers: ["evm-rpc", "coingecko", "dex-screener"] },
  base: { tier: "A_DEEP", specific: ["TOKEN_METADATA", "CONTRACT_STATE", "POOL_STATE", "LP_STATE", "OHLCV", "TOKEN_SECURITY"], providers: ["evm-rpc", "coingecko", "dex-screener"] },
  ethereum: { tier: "A_DEEP", specific: ["TOKEN_METADATA", "CONTRACT_STATE", "POOL_STATE", "LP_STATE", "OHLCV", "TOKEN_SECURITY"], providers: ["evm-rpc", "coingecko", "dex-screener"] },
  monad: { tier: "B_SHADOW", specific: ["TOKEN_METADATA", "CONTRACT_STATE", "POOL_STATE"], providers: ["evm-rpc", "coingecko", "dex-screener"] },
  sui: { tier: "B_SHADOW", specific: ["TOKEN_METADATA", "CONTRACT_STATE", "POOL_STATE"], providers: ["coingecko", "dex-screener"] },
  hyperevm: { tier: "B_SHADOW", specific: ["TOKEN_METADATA", "CONTRACT_STATE", "POOL_STATE"], providers: ["evm-rpc", "coingecko", "dex-screener"] },
  "robinhood-chain": { tier: "B_SHADOW", specific: ["TOKEN_METADATA", "CONTRACT_STATE", "POOL_STATE"], providers: ["coingecko", "dex-screener"] },
  arbitrum: { tier: "C_DISCOVERY", specific: ["TOKEN_METADATA", "POOL_STATE"], providers: ["coingecko", "dex-screener"] },
  avalanche: { tier: "C_DISCOVERY", specific: ["TOKEN_METADATA", "POOL_STATE"], providers: ["coingecko", "dex-screener"] },
  polygon: { tier: "C_DISCOVERY", specific: ["TOKEN_METADATA", "POOL_STATE"], providers: ["coingecko", "dex-screener"] },
  tron: { tier: "C_DISCOVERY", specific: ["TOKEN_METADATA", "POOL_STATE"], providers: ["coingecko", "dex-screener"] },
  "x-layer": { tier: "C_DISCOVERY", specific: ["TOKEN_METADATA", "POOL_STATE"], providers: ["coingecko", "dex-screener"] },
  megaeth: { tier: "C_DISCOVERY", specific: ["TOKEN_METADATA", "POOL_STATE"], providers: ["coingecko", "dex-screener"] },
  near: { tier: "C_DISCOVERY", specific: ["TOKEN_METADATA", "POOL_STATE"], providers: ["coingecko", "dex-screener"] },
  "op-mainnet": { tier: "C_DISCOVERY", specific: ["TOKEN_METADATA", "POOL_STATE"], providers: ["coingecko", "dex-screener"] },
};

export function createChainAcceptancePlan(chain: AcceptanceChain): ChainAcceptancePlan { const selected = PLAN_OVERRIDES[chain]; return { chain, tier: selected.tier, commonCapabilities: A_COMMON, chainSpecificCapabilities: selected.specific, providers: selected.providers }; }

export async function collectAcceptanceProbe(input: { sample: AcceptanceSample; provider: AcceptanceProviderAdapter; capability: AcceptanceCapability; metricKey: string; observedAt: string; telemetry?: AcceptanceTelemetryStore }): Promise<AcceptanceCollectionRecord> {
  const request: AcceptanceProbeRequest = { sampleId: input.sample.sampleId, tier: input.sample.tier, tokenId: input.sample.sampleId, chain: input.sample.chain, contractAddress: input.sample.tokenAddress ?? "UNASSIGNED_SAMPLE_TOKEN", capability: input.capability.toLowerCase(), acceptanceCapability: input.capability, metricKey: input.metricKey, observedAt: input.observedAt };
  const started = Date.now();
  try {
    const result = await input.provider.probe(request);
    const expected: RadarNormalizationContext = { tokenId: request.tokenId, chain: request.chain, contractAddress: request.contractAddress, provider: input.provider.provider, adapterVersion: input.provider.adapterVersion, capability: request.capability, metricKey: request.metricKey, capabilities: input.provider.capabilities };
    const normalized = normalizeProviderObservation(result.observation, new Date().toISOString(), expected);
    const record: AcceptanceCollectionRecord = { sampleId: input.sample.sampleId, chain: input.sample.chain, tier: input.sample.tier, provider: input.provider.acceptanceProvider, capability: input.capability, metricKey: input.metricKey, state: normalized.state, normalized, latencyMs: Date.now() - started, responseBytes: result.responseBytes ?? null, requestUnits: result.requestUnits ?? null, expensiveEndpoint: result.expensiveEndpoint ?? false, retryCount: result.retryCount, providerTimestamp: result.providerTimestamp ?? null, historicalDepth: result.historicalDepth ?? null, errorCode: null };
    input.telemetry?.record(record);
    return record;
  } catch (error) {
    const safe = sanitizeRadarProviderError(error);
    const record: AcceptanceCollectionRecord = { sampleId: input.sample.sampleId, chain: input.sample.chain, tier: input.sample.tier, provider: input.provider.acceptanceProvider, capability: input.capability, metricKey: input.metricKey, state: "MALFORMED", normalized: null, latencyMs: Date.now() - started, responseBytes: null, requestUnits: null, expensiveEndpoint: false, retryCount: 0, providerTimestamp: null, historicalDepth: null, errorCode: safe.code };
    input.telemetry?.record(record);
    return record;
  }
}
