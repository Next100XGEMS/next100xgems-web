import type { AcceptanceChain } from "@/lib/radar/acceptance/contracts";

const DEFAULT_BASE_URL = "https://api.coingecko.com/api/v3";

export type CoinGeckoAcceptanceResult = {
  provider: "coingecko";
  endpoint: string;
  httpStatus: number | "NETWORK_ERROR";
  latencyMs: number;
  success: boolean;
  errorCode: string | number | null;
  hasResult: boolean;
};

type CoinGeckoPayload = { status?: { error_code?: string | number } };

export class CoinGeckoDemoAcceptanceClient {
  private readonly baseUrl: string;

  constructor(
    apiKey: string,
    private readonly fetchImpl: typeof fetch = fetch,
    baseUrl = DEFAULT_BASE_URL,
  ) {
    if (!apiKey || /[\r\n]/.test(apiKey)) throw new Error("CoinGecko acceptance requires a bounded server-side API key.");
    if (!/^https:\/\/[^/?#]+(?:\/[^?#]*)?$/.test(baseUrl)) throw new Error("CoinGecko acceptance requires an HTTPS API base URL.");
    this.baseUrl = baseUrl.replace(/\/$/, "");
    this.apiKey = apiKey;
  }

  private readonly apiKey: string;

  async request(path: string): Promise<CoinGeckoAcceptanceResult> {
    if (!path.startsWith("/") || path.includes("://")) throw new Error("CoinGecko acceptance accepts relative API paths only.");
    const endpoint = `${this.baseUrl}${path}`;
    const started = Date.now();
    try {
      const response = await this.fetchImpl(endpoint, { headers: { accept: "application/json", "x-cg-demo-api-key": this.apiKey } });
      let payload: CoinGeckoPayload | null = null;
      if (response.headers.get("content-type")?.includes("application/json")) payload = await response.json() as CoinGeckoPayload;
      return {
        provider: "coingecko",
        endpoint: path.split("?")[0],
        httpStatus: response.status,
        latencyMs: Date.now() - started,
        success: response.ok && payload?.status?.error_code === undefined,
        errorCode: payload?.status?.error_code ?? (response.ok ? null : `HTTP_${response.status}`),
        hasResult: response.ok,
      };
    } catch (error) {
      return {
        provider: "coingecko",
        endpoint: path.split("?")[0],
        httpStatus: "NETWORK_ERROR",
        latencyMs: Date.now() - started,
        success: false,
        errorCode: error instanceof Error ? error.name : "NETWORK_ERROR",
        hasResult: false,
      };
    }
  }

  ping() { return this.request("/ping"); }

  simpleTokenPrice(chain: AcceptanceChain, tokenAddress: string) {
    const platform = chain === "solana" ? "solana" : chain;
    return this.request(`/simple/token_price/${encodeURIComponent(platform)}?contract_addresses=${encodeURIComponent(tokenAddress)}&vs_currencies=usd`);
  }
}
