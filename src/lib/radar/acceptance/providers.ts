import type { RadarProviderCapability, RadarProviderObservation, RadarProviderRequest } from "@/lib/radar/contracts";
import type { AcceptanceChain, AcceptanceCapability, AcceptanceProbeRequest, AcceptanceProbeResult, AcceptanceProvider, AcceptanceProviderAdapter, AcceptanceProviderProfile } from "@/lib/radar/acceptance/contracts";

type FixtureReading = Omit<RadarProviderObservation, "provider" | "adapterVersion" | "capability" | "metricKey" | "observedAt"> & { chain: AcceptanceChain; capability: AcceptanceCapability; metricKey: string; observedAt?: string; responseBytes?: number; requestUnits?: string; expensiveEndpoint?: boolean; historicalDepth?: string };

const profile = (provider: AcceptanceProvider, supportedChains: readonly AcceptanceChain[], capabilities: readonly string[], credentialEnv: string | null, deferred = false): AcceptanceProviderProfile => ({ provider, mode: "FIXTURE", supportedChains, capabilities: capabilities.map((capability) => ({ capability: capability.toLowerCase(), metrics: ["value", "usd", "proxy", "count", "default", "latest"], supportsHistorical: capability === "HISTORICAL_MARKET" })) as RadarProviderCapability[], credentialEnv, readOnlyOnly: true, deferred });
const solana = ["solana"] as const;
const evmDeep = ["bnb", "base", "ethereum"] as const;
const evmBroad = ["bnb", "base", "ethereum", "monad", "hyperevm", "robinhood-chain", "arbitrum", "avalanche", "polygon", "x-layer", "megaeth", "op-mainnet"] as const;

const PROFILES: readonly AcceptanceProviderProfile[] = [
  profile("pump-program", solana, ["TOKEN_IDENTITY", "TOKEN_DISCOVERY", "TOKEN_CREATOR", "TOKEN_AUTHORITIES", "TOKEN_SUPPLY", "TOKEN_TRANSFERS", "POOL_STATE", "QUOTE_CONTEXT", "LAUNCHPAD_LIFECYCLE", "ACTIVITY", "COVERAGE_LINEAGE"], "SOLANA_RPC_URL"),
  profile("helius", solana, ["TOKEN_IDENTITY", "TOKEN_METADATA", "TOKEN_AUTHORITIES", "TOKEN_SUPPLY", "TOKEN_CREATOR", "TOKEN_TRANSFERS", "HOLDERS", "TOP_HOLDERS", "WALLET_HISTORY", "CREATOR_HISTORY", "DEVELOPER_HISTORY", "ACTIVITY", "COVERAGE_LINEAGE"], "HELIUS_API_KEY"),
  profile("birdeye", solana, ["TOKEN_DISCOVERY", "MARKET_PAIR", "PRICE", "LIQUIDITY", "VOLUME", "TRADES", "OHLCV", "HOLDERS", "TOP_HOLDERS", "TOKEN_SECURITY", "ACTIVITY", "HISTORICAL_MARKET"], "BIRDEYE_API_KEY"),
  profile("gmgn", solana, ["TOKEN_IDENTITY", "MARKET_PAIR", "PRICE", "LIQUIDITY", "VOLUME", "OHLCV", "TOP_HOLDERS", "WALLET_HISTORY", "CREATOR_HISTORY", "TOKEN_SECURITY", "ACTIVITY"], "GMGN_API_KEY"),
  profile("coingecko", [...evmBroad, "solana"], ["MARKET_PAIR", "PRICE", "LIQUIDITY", "VOLUME", "TRADES", "OHLCV", "POOL_STATE", "HISTORICAL_MARKET", "COVERAGE_LINEAGE"], "COINGECKO_API_KEY"),
  profile("dex-screener", [...evmBroad, "solana"], ["TOKEN_DISCOVERY", "MARKET_PAIR", "PRICE", "LIQUIDITY", "VOLUME", "TRADES", "POOL_STATE", "TOKEN_METADATA"], null),
  profile("evm-rpc", evmDeep, ["TOKEN_IDENTITY", "TOKEN_METADATA", "TOKEN_SUPPLY", "TOKEN_AUTHORITIES", "TOKEN_CREATOR", "TOKEN_TRANSFERS", "CONTRACT_STATE", "POOL_STATE", "LP_STATE", "ACTIVITY", "COVERAGE_LINEAGE"], "EVM_RPC_URL"),
];

export function acceptanceProviderProfiles() { return PROFILES; }

function capabilitiesFor(provider: AcceptanceProvider): readonly RadarProviderCapability[] { return PROFILES.find((item) => item.provider === provider)?.capabilities ?? []; }

export class FixtureAcceptanceProvider implements AcceptanceProviderAdapter {
  readonly mode = "FIXTURE" as const;
  readonly adapterVersion = "acceptance-fixture-v1";
  readonly provider: AcceptanceProvider;
  readonly capabilities: readonly RadarProviderCapability[];
  readonly supportedChains: readonly AcceptanceChain[];
  private readonly readings: ReadonlyMap<string, FixtureReading>;
  constructor(readonly acceptanceProvider: AcceptanceProvider, readings: readonly FixtureReading[] = []) {
    this.provider = acceptanceProvider;
    const descriptor = PROFILES.find((item) => item.provider === acceptanceProvider);
    this.supportedChains = descriptor?.supportedChains ?? [];
    this.capabilities = capabilitiesFor(acceptanceProvider);
    this.readings = new Map(readings.map((reading) => [`${reading.chain}:${reading.capability}:${reading.metricKey}`, reading]));
  }
  async observe(request: RadarProviderRequest): Promise<RadarProviderObservation> {
    const item = this.readings.get(`${request.chain}:${request.capability.toUpperCase()}:${request.metricKey}`);
    if (item) return { ...item, provider: this.acceptanceProvider, adapterVersion: this.adapterVersion, capability: request.capability, metricKey: request.metricKey, observedAt: item.observedAt ?? request.observedAt };
    const known = this.supportedChains.includes(request.chain as AcceptanceChain) && this.capabilities.some((item) => item.capability === request.capability);
    return { provider: this.acceptanceProvider, adapterVersion: this.adapterVersion, capability: request.capability, metricKey: request.metricKey, state: known ? "UNKNOWN" : "UNSUPPORTED", reason: known ? "fixture reading is not configured" : "fixture provider does not cover this chain or capability", observedAt: request.observedAt };
  }
  async probe(request: AcceptanceProbeRequest): Promise<AcceptanceProbeResult> {
    const response = await this.observe(request);
    const item = this.readings.get(`${request.chain}:${request.acceptanceCapability}:${request.metricKey}`);
    return { observation: response, responseBytes: item?.responseBytes, providerTimestamp: item?.observedAt, retryCount: 0, requestUnits: item?.requestUnits, expensiveEndpoint: item?.expensiveEndpoint, historicalDepth: item?.historicalDepth };
  }
}
