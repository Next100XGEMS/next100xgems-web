# Design System Direction

## Character

NEXT100XGEMS should feel like a premium crypto intelligence terminal combined with a high-end financial publication. Bloomberg × Dune × Linear are directional references only; the final identity must be original.

## Preferences

- Near-black or dark-neutral foundation.
- Strong off-white typography and restrained accent color.
- High information clarity and readable data density.
- Subtle borders, minimal glow, minimal gradients.
- Excellent charts and data visualization.
- Generous whitespace where useful.
- Strong typographic hierarchy.
- Selective monospace treatment for market/data values.
- Clear disclosure labels and responsive behavior.

## Avoid

Generic influencer styling, excessive neon or gradients, black/gold cliché aesthetics, casino-like visuals, oversized influencer portraits, fake counters, unverifiable claims, cluttered advertising, excessive animation, cheap glassmorphism, and template-looking crypto UI.

## Content signals

Public interfaces must make distinctions visible: EDITORIAL, SPONSORED, PARTNER, ADVERTISEMENT, and AI-ASSISTED ANALYSIS. Visual design must not make paid content resemble an organic Radar signal.

## Gate 9 implementation

Gate 9 establishes the first reusable visual foundation without implementing public product pages. The local laboratory is available at `/design-system` during development and is guarded with `notFound()` in production; it is not linked from public navigation.

### Tokens and visual language

The dark foundation is defined in `src/app/globals.css` with CSS custom properties and Tailwind theme aliases. It includes the application canvas, three surface levels, primary/secondary/tertiary text, subtle/strong borders, restrained mint accent, focus, positive, negative, warning, and informational semantics. Commercial and evidence semantics have separate restrained tokens for `EDITORIAL`, `SPONSORED`, `PARTNER`, `ADVERTISEMENT`, `RADAR`, `AI-ASSISTED`, `VERIFIED DATA`, `STRONG SIGNAL`, `AI INFERENCE`, and `UNKNOWN`.

Geist remains the primary reading typeface. The official `geist` package provides locally packaged Geist Sans and Geist Mono assets, so production builds do not fetch Google Fonts. Monospace is reserved for prices, market values, percentages, timestamps, and technical identifiers. Layout tokens cover a reading width, composed content width, page gutters, section rhythm, grid gaps, panel/control radii, and responsive density.

### Primitives

The small typed primitive set in `src/components/ui/primitives.tsx` includes `Container`, `Section`, `Stack`, `Cluster`, `InstrumentRule`, `Button`, `IconButton`, `Panel`, `Divider`, `StatusLabel`, `DisclosureLabel`, `DataValue`, `Metric`, `SectionHeader`, `PageHeader`, `DataRow`, `KeyValueRow`, `EmptyState`, `Skeleton`, and `VisuallyHidden`. They use semantic HTML, visible keyboard focus, disabled/loading states, responsive wrapping, and reduced-motion CSS.

`InstrumentRule` is the provisional signature device: a small calibration line with measured ticks used only at analytical transitions and data surfaces. `Panel` supports related `editorial`, `radar`, `commercial`, and `admin` surface families through restrained border, contrast, and density changes rather than separate visual systems. Commercial disclosure labels remain explicit and visually separate from Radar/evidence labels. The laboratory uses clearly marked mock values only for composition testing; it does not fetch data or implement product behavior.

The Radar composition now separates token identity, freshness, market metrics, risk, and evidence confidence. Research uses a publication-style headline and TL;DR treatment; Sponsored uses a warmer commercial surface, explicit paid disclosure, campaign/category metadata, and restrained CTA; Admin uses tighter alignment, measured rules, and operational status rows. These are visual compositions only.

These values and visual choices are a provisional Gate 9 foundation. Final brand decisions, chart conventions, and product-specific composition remain subject to review before later page gates.

## Gate 12 public shell

The reusable public shell lives in the `(public)` route group and is composed from `PublicHeader`, `PublicFooter`, and `PublicShell`. It reuses the Gate 9 `Container`, `Section`, `PageHeader`, `InstrumentRule`, and `Panel` primitives. Public navigation covers Radar, Research, Partners, Advertise, Network, and Work With Us; Admin and the development-only design-system laboratory are intentionally excluded. The current public routes are structural placeholders without product data, queries, or business workflows.
