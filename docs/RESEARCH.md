# NEXT100XGEMS Research

## Positioning

Research is the first-party publication layer for crypto research, market intelligence, and editorial analysis. It is not a news-reposting feed, influencer article page, paid-token directory, or buy/sell signal feed.

Radar surfaces intelligence. Research investigates context more deeply. The products may reference one another, but Research retains its own editorial/research classification and disclosure treatment.

## Public information architecture

- `/research` — category rail, research standard, honest latest-research state, classifications, methodology connection, and the Research/Radar relationship.
- `/research/[slug]` — production article route architecture. It returns not-found until a real published article source exists.
- `/research-preview` — development-only article presentation preview. It is not linked from public navigation and returns not-found in production.

Confirmed presentation categories are Market, Memecoins, Altcoins, and Deep Dives. The public library is populated only from the Gate 18B published Research projection; when it is empty, the landing page keeps the honest empty state without inventing counts, article history, authors, dates, or records.

## Article presentation contract

The typed `ResearchArticle` presentation contract in `src/components/research/research-content.ts` includes only fields needed to render an article: identity and slug, title/dek, category, primary classification, optional AI-assisted and Radar context, author display information, publication dates, optional featured image reference, TL;DR, key facts with optional evidence state, bounded structured analysis blocks, optional data/chart embed areas, sources, related research, related tokens, disclosure, and SEO overrides. `ResearchArticleSummary` is the smaller landing-card contract.

This is a public presentation contract, not a database model. The server-only Research reader maps and validates the explicit fields returned by Gate 18B's public projection into this contract.

## Classifications and disclosure

- `EDITORIAL` — independent research/editorial content.
- `SPONSORED` — paid content or placement.
- `PARTNER` — content or context associated with a disclosed commercial relationship.
- `AI-ASSISTED` — AI contributed to analysis or production and may coexist with another classification.

Paid classifications remain visible near the article header. Radar context may be shown separately and never replaces the article classification.

## Article anatomy

The renderer supports a publication-style header, TL;DR, Key Facts, readable analysis sections, closed paragraph/quote/callout/data-placeholder blocks, optional data/chart embed areas, Sources, optional Related Research, optional Related Tokens, disclosure, and a route back to the Research landing page. Key Facts can carry evidence context without automatically asserting `VERIFIED DATA`. Database body content is rendered as escaped text; unknown blocks fail the adapter rather than becoming HTML or executable markup.

Sources are supplied by article data, rendered as a semantic list, and only `http`/`https` URLs become external links. Related tokens are contextual references and are not recommendations.

## SEO and structured data

`generateResearchArticleMetadata()` provides factual title/description, a relative canonical path, Open Graph article basics, and a summary Twitter card from real published article values. `researchArticleStructuredData()` and its safe serializer produce `Article` JSON-LD only for a real published article; development preview content omits it and values are never fabricated. The publisher identity is NEXT100XGEMS and no external canonical domain is assumed.

## Development preview policy

The preview uses neutral fixture content and an unmistakable `SAMPLE / DEVELOPMENT PREVIEW` label. It is excluded from public navigation and the page calls `notFound()` when `NODE_ENV` is `production`. Fixture content is not included in the empty production article collection.

## Gate 18C implementation

Gate 18C connects `/research` and `/research/[slug]` to the server-only `src/lib/research/server.ts` reader. It uses only `read_public_research_page` and `read_public_research_article`, the narrow Gate 18B public projections, with the publishable Supabase key and no cookies or persistent sessions. Reads are request-time and uncached so publication and availability changes become visible on subsequent requests. `research_enabled` gates public retrieval; disabled Research is not queried or exposed. Empty results, confirmed not-found slugs, and genuine read failures remain distinct.

`/research-preview` remains a development-only fixture route and never reads the database or emits Article JSON-LD. Gate 18D implements the authenticated Admin CMS, preview, mutation Server Actions, and explicit lifecycle controls; media handling and richer workflow expansion remain deferred.

## Gate 18D operational Admin CMS

The authenticated Admin Research workspace now lives at `/admin/research`, `/admin/research/new`, `/admin/research/[id]`, and `/admin/research/[id]/preview`. It reads through the existing cookie-backed user session and database RLS, never through the server secret key. The list exposes only real RLS-visible records grouped by Draft, Scheduled, Published, and Archived state.

The editor provides explicit Save Draft, Schedule, Publish, Archive, and Restore → Draft controls; scheduling does not publish automatically. It includes TL;DR, Key Facts with evidence states, category, AI-assisted indicator, accountable public byline, structured plain-text sections/blocks, HTTP(S) sources, related Research/tokens, disclosure, classification, and SEO fields. Sponsored and Partner labels remain prominent. All writes call the named Gate 18B audited RPCs and revision conflicts fail safely; no direct table writes or second audit call are made by the application.

The Admin preview is private, request-time, noindex, visibly marked unpublished, and omits Article JSON-LD. It reuses the safe public renderer without exposing private profile/auth data or making a publication claim. Rich text, arbitrary HTML, media uploads, autosave, source fetching, and automatic publishing remain intentionally deferred.
