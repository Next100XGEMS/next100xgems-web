# Radar Public UX — Gate 19B

Gate 19B establishes the public Radar presentation before Radar has provider, ingestion, database publication, or scoring infrastructure. It is a visual and interaction contract only. The real `/radar` route is truthful and contains no token records; the development preview is the only place where sample values appear.

## 1. Public information architecture

`/radar` presents the Radar product boundary in this order: hero and positioning, current public state, intelligence workflow, analytical status/evidence semantics, evaluation categories, freshness and review, commercial independence, and the empty-state/next-step message. It links to `/methodology` and `/disclosures`. It does not link to a fake feed.

The page describes Radar as watch-only intelligence: it discovers, filters, analyzes, organizes evidence, supports human review, and publishes approved intelligence. It does not present an execution surface or imply a financial outcome.

## 2. Public empty-state behavior

The production `/radar` route now reads the published-only `get_public_radar_list` projection with the publishable Supabase client. The database projection remains responsible for feature flags, maintenance mode, emergency pause, approved methodology/freshness policy, expiry, publication state, and privacy boundaries. Empty and unavailable states are explicit; private analysis rows and development fixtures are never used as a public fallback.

The route is dynamic and does not claim live or universal real-time coverage. A flag value does not create a publication or bypass future database/publication gates.

## 3. Fixture policy

`/radar-preview` and `/radar-preview/[token]` are development-only. They call `notFound()` when `NODE_ENV` is `production`, are not in public navigation, and label every surface `DEVELOPMENT PREVIEW · SAMPLE DATA`. Fixture identities use `TOKEN A`, `TOKEN B`, and `SAMPLE-ONLY-*` values. They are typed local presentation data only; no fixture is inserted into Supabase, rendered by `/radar`, or used as a production fallback.

## 4. List presentation

The preview list is dense and scannable: synthetic identity, analytical status, freshness, sample score/methodology, provider state, and market-context metrics appear together. It uses aligned borders, monospace data labels, subdued Radar surfaces, and no chart or screener decoration. Each item links only to its synthetic development detail.

The production page intentionally has no list until a reviewed public projection exists.

## 5. Detail presentation

The development detail route represents the future token-detail shape: identity, status, freshness, contextual sample score, market/on-chain snapshot, evidence, risk context, reasons for appearance, source/provider state, methodology, editorial note, publication state, disclosure, and a return link. Long synthetic identifiers wrap safely and expose their full value in the text/title treatment.

The route has no production token route and no user controls that could imply publication authority.

## 6. Score presentation

Fixture scores are labeled `Radar Score · SAMPLE` and paired with a methodology version and contextual language. The UI does not supply a scale, probability interpretation, target, or formula. The score is described as a versioned system output, not a forecast or recommendation. The production page shows no numeric score.

## 7. Evidence presentation

Reusable evidence presentation keeps `VERIFIED DATA`, `STRONG SIGNAL`, `AI INFERENCE`, and `UNKNOWN` visibly distinct. Each sample item can show a concise label, context, provenance, and freshness. AI inference never receives verified-data styling. `UNKNOWN` is text-labeled and neutral/uncertain, not positive.

## 8. UNKNOWN and provider-failure presentation

Fixtures include unavailable, unsupported, timeout, stale, and unknown states. They use words such as `Unknown`, `Unavailable`, `Not supported`, and `Stale`; they do not substitute `0`, `0%`, healthy, or safe. The public explanation states that unavailable data is not zero and does not indicate safety.

## 9. Freshness semantics

The public explanation introduces `FRESH`, `AGING`, `STALE`, and `UNKNOWN`. Preview records show freshness beside identity and evidence, with context describing the sample window. Stale or unknown inputs remain visible as limitations; later publication logic may suppress or require review under the Gate 19A policy. Gate 19B does not implement freshness calculation.

## 10. Risk presentation

Risk is prominent but measured. Preview detail uses a short list of risk contexts—concentration, liquidity, contract support, data quality, and freshness—rather than a binary safe/unsafe panel or dramatic warning treatment. `HIGH RISK` is a textual analytical status and is not an action signal.

## 11. Commercial separation

The Radar page includes the trust note `Sponsored ≠ Radar ranking.` It states that sponsorship cannot purchase Radar Score, ranking, risk, evidence, analytical status, or organic visibility. Commercial labels and surfaces do not appear inside preview result items.

## 12. Responsive and accessibility rules

At narrow widths, identity, status, freshness, and risk remain first; secondary metrics wrap below. Long identifiers use wrapping and a title value. Sections use headings and lists, status meaning is written as text rather than color alone, and links have visible focus behavior from the shared design system. Each page has one H1. No interaction requires hover, motion, or a horizontal data table.

## Gate 19C handoff

Gate 19C must replace only the production empty state after it has created the reviewed database/publication contracts and narrow public projections. It must preserve the DTO distinctions established here: published-only records, explicit evidence origin, UNKNOWN/provider failure, freshness, methodology version, public disclosure, and no secret-key dependency for normal public reads. It must not seed these fixtures or treat this preview as a live-data adapter.
