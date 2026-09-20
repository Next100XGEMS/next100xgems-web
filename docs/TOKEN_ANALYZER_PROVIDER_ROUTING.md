# Universal Token Analyzer provider routing

Status: internal deterministic development phase. No provider is public,
paid, or execution-capable through this routing layer.

| Chain / input | Primary authority | Market source | Conditional source |
| --- | --- | --- | --- |
| Solana mint | Helius/Solana RPC plus Pump/PumpSwap state | Birdeye | DEX Screener fallback/comparison; CoinGecko selective; GMGN optional context |
| Solana DEX URL | URL pair identity, then chain/provider base-token resolution | Birdeye or DEX Screener pair response | CoinGecko selective comparison |
| Ethereum contract | Alchemy read-only RPC | DEX Screener | CoinGecko selective |
| Base contract | Alchemy read-only RPC | DEX Screener | CoinGecko selective |
| BNB contract | Alchemy read-only RPC | DEX Screener | CoinGecko selective |

## Capability semantics

The collector advertises SUPPORTED, UNSUPPORTED, NOT_CONFIGURED, or
TEMPORARILY_UNAVAILABLE for each provider/capability pair. A capability is
not called when it is unsupported or unconfigured. Provider-derived fields
remain provider-derived; GMGN labels never become direct verified facts.

Current deterministic capabilities include token identity, supply/decimals,
Solana mint authorities, largest-account concentration, Pump lifecycle where
decoding succeeds, market price, market cap/FDV as separately labelled,
liquidity, pool identity where the pair identifier is a valid chain address,
volume, transaction activity, and creator/owner observations. Top trades, full
holder census, deployer history, and social/article interpretation remain
UNKNOWN or explicitly unavailable unless an accepted source supports them.

## Request safety and cost

Provider calls are server-only and use an eight-second timeout. Only 429 and
5xx responses receive one bounded backoff retry; timeout and non-retryable
errors stop immediately. Error telemetry is reduced to safe categories such
as TIMEOUT, RATE_LIMITED, and HTTP_4xx. No API key is printed, persisted,
sent to the browser, or included in telemetry.

The development ceiling is 50,000 estimated additional Helius credits. No
paid upgrade or production scheduler is authorized. Repeated routine requests
reuse the same sealed delivery inside the configured reuse window. The local
smoke runner must leave token_analyzer_enabled OFF after the run, while
token_analyzer_public_enabled remains OFF at all times.

Social/article retrieval is intentionally not live in this phase, and no AI,
Radar methodology, public publication, wallet, signing, or execution path is
connected.
