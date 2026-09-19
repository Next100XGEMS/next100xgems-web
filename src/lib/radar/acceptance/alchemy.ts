import type { AcceptanceChain } from "@/lib/radar/acceptance/contracts";

export const ALCHEMY_EVM_NETWORKS = {
  ethereum: "eth-mainnet",
  base: "base-mainnet",
  bnb: "bnb-mainnet",
  arbitrum: "arb-mainnet",
  avalanche: "avax-mainnet",
  polygon: "polygon-mainnet",
  "op-mainnet": "opt-mainnet",
} as const satisfies Partial<Record<AcceptanceChain, string>>;

const READ_ONLY_METHODS = new Set(["eth_blockNumber", "eth_getCode", "eth_call", "eth_getLogs", "alchemy_getAssetTransfers", "alchemy_getTokenMetadata", "alchemy_getTokenBalances"]);

export type AlchemyAcceptanceResult = { chain: AcceptanceChain; method: string; httpStatus: number | "NETWORK_ERROR"; latencyMs: number; success: boolean; errorCode: string | number | null; hasResult: boolean };

export class AlchemyReadOnlyAcceptanceClient {
  private readonly endpoints: Partial<Record<AcceptanceChain, string>>;
  constructor(apiKey: string, private readonly fetchImpl: typeof fetch = fetch) {
    if (!apiKey || /[\r\n]/.test(apiKey)) throw new Error("Alchemy acceptance requires a bounded server-side API key.");
    this.endpoints = Object.fromEntries(Object.entries(ALCHEMY_EVM_NETWORKS).map(([chain, network]) => [chain, `https://${network}.g.alchemy.com/v2/${apiKey}`])) as Partial<Record<AcceptanceChain, string>>;
  }

  async request(chain: AcceptanceChain, method: string, params: readonly unknown[] = []): Promise<AlchemyAcceptanceResult> {
    if (!READ_ONLY_METHODS.has(method)) throw new Error("Alchemy acceptance permits read-only methods only.");
    const endpoint = this.endpoints[chain];
    const started = Date.now();
    if (!endpoint) return { chain, method, httpStatus: "NETWORK_ERROR", latencyMs: 0, success: false, errorCode: "UNSUPPORTED_CHAIN", hasResult: false };
    try {
      const response = await this.fetchImpl(endpoint, { method: "POST", headers: { "content-type": "application/json", accept: "application/json" }, body: JSON.stringify({ jsonrpc: "2.0", id: 1, method, params }) });
      const payload = response.ok ? await response.json() as { result?: unknown; error?: { code?: string | number } } : null;
      return { chain, method, httpStatus: response.status, latencyMs: Date.now() - started, success: response.ok && payload?.error === undefined, errorCode: payload?.error?.code ?? (response.ok ? null : `HTTP_${response.status}`), hasResult: payload?.result !== undefined };
    } catch (error) {
      return { chain, method, httpStatus: "NETWORK_ERROR", latencyMs: Date.now() - started, success: false, errorCode: error instanceof Error ? error.name : "NETWORK_ERROR", hasResult: false };
    }
  }
}

