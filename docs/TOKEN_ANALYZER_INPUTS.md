# Universal Token Analyzer inputs

The resolver accepts bounded plain text and classifies it as:

`CONTRACT_ADDRESS`, `TOKEN_MINT`, `DEX_URL`, `CHART_URL`, `X_POST`, `ARTICLE`,
`FACEBOOK_POST`, `INSTAGRAM_POST`, `GENERIC_URL`, or `UNKNOWN`.

Known DEX/chart URL shapes currently extract chain, token, pair, or pool only
when the URL structure contains a syntactically valid identifier. URL labels,
symbols, and names never establish identity. The resulting identity remains
partial until an approved chain/provider observation verifies it.

Solana and EVM semantics remain separate. EVM addresses are recognized as
`0x` plus 40 hexadecimal characters; Solana mint strings use the bounded
base58 form. A chain hint may disambiguate an otherwise valid address but does
not turn an invalid address into a token.

Social and article URLs are untrusted content. Retrieval, when later enabled,
must use the SSRF-safe server helper. Content is bounded and sanitized; prompt
instructions inside a source cannot control the Analyzer. Facebook and
Instagram are allowed to return `SOURCE_CONTENT_UNAVAILABLE` or
`PROVIDER_NOT_CONFIGURED` rather than using unauthorized scraping.

For deterministic live testing, a Solana mint is preserved with exact base58
casing and is enriched only after a chain/provider observation. An EVM contract
is normalized to lowercase for canonical identity. A DEX URL is resolved as
pair/pool structure first, then the selected source must return the base token
before the Analyzer reports a token identity. A provider pair identifier that
is not a valid chain address remains provider metadata and is not presented as
an authoritative pool address.

For deterministic live testing, a Solana mint is preserved with exact base58
casing and is enriched only after a chain/provider observation. An EVM contract
is normalized to lowercase for canonical identity. A DEX URL is resolved as
pair/pool structure first, then the selected source must return the base token
before the Analyzer reports a token identity. A provider pair identifier that
is not a valid chain address remains provider metadata and is not presented as
an authoritative pool address.
