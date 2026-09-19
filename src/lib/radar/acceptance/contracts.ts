import type { RadarDataState, RadarNormalizedObservation, RadarProviderAdapter, RadarProviderCapability, RadarProviderObservation, RadarProviderRequest } from "@/lib/radar/contracts";

export const ACCEPTANCE_CHAINS = [
  "solana", "bnb", "base", "ethereum", "monad", "sui", "hyperevm", "robinhood-chain",
  "arbitrum", "avalanche", "polygon", "tron", "x-layer", "megaeth", "near", "op-mainnet",
] as const;
export type AcceptanceChain = (typeof ACCEPTANCE_CHAINS)[number];
export type AcceptanceTier = "A_DEEP" | "B_SHADOW" | "C_DISCOVERY";

export const ACCEPTANCE_PROVIDERS = ["pump-program", "helius", "birdeye", "gmgn", "coingecko", "dex-screener", "evm-rpc"] as const;
export type AcceptanceProvider = (typeof ACCEPTANCE_PROVIDERS)[number];

export const ACCEPTANCE_CAPABILITIES = [
  "TOKEN_IDENTITY", "TOKEN_DISCOVERY", "TOKEN_METADATA", "TOKEN_AUTHORITIES", "TOKEN_SUPPLY",
  "TOKEN_CREATOR", "TOKEN_TRANSFERS", "MARKET_PAIR", "PRICE", "LIQUIDITY", "VOLUME", "TRADES",
  "OHLCV", "MARKET_DEPTH", "QUOTE_CONTEXT", "POOL_STATE", "LP_STATE", "HOLDERS", "TOP_HOLDERS",
  "HOLDER_HISTORY", "WALLET_HISTORY", "CREATOR_HISTORY", "DEVELOPER_HISTORY", "ADDRESS_LABELS",
  "TOKEN_SECURITY", "ACTIVITY", "LAUNCHPAD_LIFECYCLE", "CONTRACT_STATE", "COVERAGE_LINEAGE",
  "PROVIDER_STATUS", "HISTORICAL_MARKET",
] as const;
export type AcceptanceCapability = (typeof ACCEPTANCE_CAPABILITIES)[number];

export type AcceptanceSampleCategory = "NEW_LAUNCH" | "ACTIVE_LAUNCH" | "NEAR_MIGRATION" | "RECENTLY_MIGRATED" | "ESTABLISHED" | "DEAD_FAILED" | "CONCENTRATED" | "HIGH_VOLUME" | "SUSPICIOUS_RISKY";
export type AcceptanceSample = {
  sampleId: string;
  chain: AcceptanceChain;
  tier: AcceptanceTier;
  category: AcceptanceSampleCategory;
  tokenAddress: string | null;
  label: string | null;
  notes: string | null;
  approvedForLiveProbe: boolean;
};

export type AcceptanceDataset = {
  schemaVersion: "radar-acceptance-dataset-v1";
  createdAt: string;
  samples: readonly AcceptanceSample[];
};

export type AcceptanceProbeRequest = RadarProviderRequest & {
  sampleId: string;
  tier: AcceptanceTier;
  acceptanceCapability: AcceptanceCapability;
};

export type AcceptanceProbeResult = {
  observation: RadarProviderObservation;
  responseBytes?: number;
  providerTimestamp?: string;
  retryCount: number;
  requestUnits?: string;
  expensiveEndpoint?: boolean;
  historicalDepth?: string;
};

export type AcceptanceProviderAdapter = RadarProviderAdapter & {
  readonly acceptanceProvider: AcceptanceProvider;
  readonly mode: "FIXTURE" | "LIVE";
  readonly supportedChains: readonly AcceptanceChain[];
  probe(request: AcceptanceProbeRequest): Promise<AcceptanceProbeResult>;
};

export type AcceptanceCollectionRecord = {
  sampleId: string;
  chain: AcceptanceChain;
  tier: AcceptanceTier;
  provider: AcceptanceProvider;
  capability: AcceptanceCapability;
  metricKey: string;
  state: RadarDataState | "MALFORMED";
  normalized: RadarNormalizedObservation | null;
  latencyMs: number;
  responseBytes: number | null;
  requestUnits: string | null;
  expensiveEndpoint: boolean;
  retryCount: number;
  providerTimestamp: string | null;
  historicalDepth: string | null;
  errorCode: string | null;
};

export type AcceptanceProviderProfile = {
  provider: AcceptanceProvider;
  mode: "FIXTURE" | "LIVE";
  supportedChains: readonly AcceptanceChain[];
  capabilities: readonly RadarProviderCapability[];
  credentialEnv: string | null;
  readOnlyOnly: boolean;
  deferred: boolean;
};

export type AcceptanceComparisonStatus = "AGREEMENT" | "DISAGREEMENT" | "MISSING" | "STALE";
export type AcceptanceComparison = {
  chain: AcceptanceChain;
  sampleId: string;
  capability: AcceptanceCapability;
  metricKey: string;
  leftProvider: AcceptanceProvider;
  rightProvider: AcceptanceProvider;
  status: AcceptanceComparisonStatus;
  leftValue: string | null;
  rightValue: string | null;
  reason: string;
};

export type AcceptanceUsageProjection = {
  callsPerSample: string;
  callsPerDay: { 100: string; 1000: string; 10000: string };
  unitsPerSample: string | null;
  unitsPerDay: { 100: string | null; 1000: string | null; 10000: string | null };
  measuredFromRecords: number;
};
