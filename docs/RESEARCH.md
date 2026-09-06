# NEXT100XGEMS Research

## Positioning

Research is the first-party publication layer for crypto research, market intelligence, and editorial analysis. It is not a news-reposting feed, influencer article page, paid-token directory, or buy/sell signal feed.

Radar surfaces intelligence. Research investigates context more deeply. The products may reference one another, but Research retains its own editorial/research classification and disclosure treatment.

## Public information architecture

- `/research` — category rail, research standard, honest latest-research state, classifications, methodology connection, and the Research/Radar relationship.
- `/research/[slug]` — production article route architecture. It returns not-found until a real published article source exists.
- `/research-preview` — development-only article presentation preview. It is not linked from public navigation and returns not-found in production.

Confirmed presentation categories are Market, Memecoins, Altcoins, and Deep Dives. No counts, article history, authors, dates, or production records are invented while the library is empty.

## Article presentation contract

The typed `ResearchArticle` presentation contract in `src/components/research/research-content.ts` includes only fields needed to render an article: identity and slug, title/dek, category, primary classification, optional AI-assisted and Radar context, author display information, publication dates, optional featured image reference, TL;DR, key facts with optional evidence state, structured analysis sections, optional data/chart embed areas, sources, related research, related tokens, disclosure, and SEO overrides.

This is a public presentation contract, not a database model. The current published collection is intentionally empty and can later be replaced by the Gate 18 repository/data source.

## Classifications and disclosure

- `EDITORIAL` — independent research/editorial content.
- `SPONSORED` — paid content or placement.
- `PARTNER` — content or context associated with a disclosed commercial relationship.
- `AI-ASSISTED` — AI contributed to analysis or production and may coexist with another classification.

Paid classifications remain visible near the article header. Radar context may be shown separately and never replaces the article classification.

## Article anatomy

The renderer supports a publication-style header, TL;DR, Key Facts, readable analysis sections, optional data/chart embed areas, Sources, optional Related Research, optional Related Tokens, disclosure, and a route back to the Research landing page. Key Facts can carry evidence context without automatically asserting `VERIFIED DATA`.

Sources are supplied by article data, rendered as a semantic list, and only `http`/`https` URLs become external links. Related tokens are contextual references and are not recommendations.

## SEO and structured data

`generateResearchArticleMetadata()` provides factual title/description, a relative canonical path, Open Graph article basics, and a summary Twitter card from real article values. `researchArticleStructuredData()` and its safe serializer produce `Article` JSON-LD only when a real article is supplied; values are never fabricated. The publisher identity is NEXT100XGEMS and no external canonical domain is assumed.

## Development preview policy

The preview uses neutral fixture content and an unmistakable `SAMPLE / DEVELOPMENT PREVIEW` label. It is excluded from public navigation and the page calls `notFound()` when `NODE_ENV` is `production`. Fixture content is not included in the empty production article collection.

## Gate 18 handoff

Gate 18 may replace the empty `publishedResearchArticles` source with a reviewed repository/data source, add CMS/article persistence, author and source records, real related content, publishing controls, and production media handling. Those concerns are intentionally absent from Gate 17.
