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
