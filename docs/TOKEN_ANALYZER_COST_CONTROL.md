# Universal Token Analyzer cost control

The Analyzer is selective by design: one primary evidence source, conditional
verification, cached normalized observations, and stable request/evidence
fingerprints. It must not query every provider for every request.

The schema and trusted telemetry RPCs reserve fields for future AI cost
accounting. A production AI budget runner, spend reservation, and provider
call path are NOT YET ACTIVE. No AI call can occur merely because a key or
configuration exists.

Provider events and cost usage are bounded structured telemetry. API keys,
headers, cookies, raw prompts, hidden reasoning, and unbounded provider
responses are not retained. Slow-changing observations use their freshness
class; fresh cached evidence is reused for the same deterministic request.

No model provider or paid plan is selected or enabled by this foundation.

## Live deterministic budget

The internal live connector uses bounded timeouts, one retry only for 429/5xx
responses, and no retry storm. Routine market collection starts with DEX
Screener and conditionally adds Birdeye on Solana; Helius/Solana RPC or
Alchemy are called only for the matching chain. CoinGecko and GMGN remain
selective/optional and are not routine fan-out providers. Provider usage is
attached to the sealed analysis receipt without storing URLs containing keys,
headers, raw payloads, or credentials.

This phase has a development ceiling of 50,000 estimated additional Helius
credits, no paid upgrades, and no production scheduler. A repeated request
inside the existing five-minute reuse window returns the same immutable
receipt and does not collect another provider snapshot.

## Live deterministic budget

The internal live connector uses bounded timeouts, one retry only for 429/5xx
responses, and no retry storm. Routine market collection starts with DEX
Screener and conditionally adds Birdeye on Solana; Helius/Solana RPC or
Alchemy are called only for the matching chain. CoinGecko and GMGN remain
selective/optional and are not routine fan-out providers. Provider usage is
attached to the sealed analysis receipt without storing URLs containing keys,
headers, raw payloads, or credentials.

This phase has a development ceiling of 50,000 estimated additional Helius
credits, no paid upgrades, and no production scheduler. A repeated request
inside the existing five-minute reuse window returns the same immutable
receipt and does not collect another provider snapshot.
