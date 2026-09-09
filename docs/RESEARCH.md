# NEXT100XGEMS Research

Status: Research system COMPLETE through Gate 18E4. Gates 18F1, 18F2,
18F3, and 18F4 are complete. Gate 18E4 passed with non-blocking findings;
H1, M1, M2, and M3 are fixed, with no Critical, High, or Medium finding
remaining.

The remaining coverage note is a dedicated mounted Editorial → Partner
disclosure-synchronization test that may be added later. The shared
reconciliation path is already validated, so this is not a Research
completion blocker. Radar remains separately gated.

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

## Gate 18F2 public contract alignment

The corrective migration `20260909000001_research_public_contract.sql` keeps the Gate 18B tables, RLS, grants, role semantics, lifecycle, and atomic audit model unchanged while aligning newly saved and published content with the public reader. Source titles are limited to 240 characters, publishers to 160, public byline name/title fields to 160, and related Research/token relationships to the existing 12-row public boundary. Structured sections and optional structural block IDs must be unique; callouts and data placeholders require nonblank labels. Historical private rows are not rewritten, while publication revalidates legacy rows before exposing them.

The Admin validator, server DTO adapter, and renderer now share these limits. Canonical token `symbol` and `name` remain nullable end to end; the public presentation uses available labels and falls back to the truthful chain/contract identity rather than inventing a token name. Boundary regressions are covered by application tests and isolated pgTAP tests. No remote project, Radar functionality, or production data is involved.

## Gate 18F4 final public contract correction

Gate 18F4 adds the final explicit cross-layer Research contract. Required
blankness uses the same set in TypeScript and PostgreSQL: tab, line breaks,
ASCII space, NBSP, Ogham space, U+2000–U+200A, line/paragraph separators,
narrow NBSP, medium mathematical space, ideographic space, and BOM. The
contract tests blankness without trimming or normalizing valid content.

Research source URLs are limited to HTTP(S) with an ASCII DNS hostname or
unambiguous dotted-decimal IPv4 host, optional valid port, and no userinfo;
IPv6 and internationalized hosts remain deferred. Source dates are ISO
Gregorian AD/CE dates from 0001-01-01 through 9999-12-31. Public timestamps
are bounded to the same application-representable AD range. Database
publication validation and the server DTO reader use these same rules,
including title, structured IDs, callout labels, sources, and dates.

## Gate 18F3 public contract alignment

Gate 18F3 adds a shared `unicodeCodePointLength()` utility for Admin and public-reader validation, matching PostgreSQL `char_length(text)` semantics. Bounded values are measured as stored, without trimming or truncation; required text rejects empty and whitespace-only values, and structured identifiers reject whitespace forms. The additive `20260909000002_research_contract_alignment.sql` migration applies the same raw/code-point and blank-value rules to Research mutation/publication validation.

The public reader now accepts legitimate nullable canonical token labels without imposing arbitrary Research-only name, symbol, or contract limits. It retains truthful chain/contract identity and renders registry values as escaped text. Publication success is the compatibility boundary: a published Research article must pass the public projection, DTO, listing/detail, metadata, and renderer contract. No RLS, grants, RBAC, audit, lifecycle, token-registry, or Radar behavior changed.
