# Feature Flags — Gate 7

## Purpose

Feature flags are database-backed operational availability controls. They are evaluated by a small server-only module and do not grant permissions. Role authorization remains enforced by the application authorization layer and PostgreSQL RLS.

## Canonical flags and defaults

The supported system keys are:

| Key | Default | Meaning |
|---|---:|---|
| `radar_enabled` | `false` | Master public Radar availability control |
| `research_enabled` | `false` | Public research availability control |
| `advertising_enabled` | `false` | Master advertising availability control |
| `featured_partners_enabled` | `false` | Featured Partner display control |
| `booking_enabled` | `false` | Booking entry-point control |
| `newsletter_enabled` | `false` | Newsletter entry-point control |
| `maintenance_mode` | `true` | Restricts normal public operation while preserving authorized recovery access |
| `radar_auto_publish` | `false` | Independent automation permission; never a substitute for review or publication rules |
| `token_analyzer_enabled` | `false` | Private Owner/Admin Analyzer availability; fails closed |
| `token_analyzer_public_enabled` | `false` | Reserved future public Analyzer availability; no public route exists |
| `project_console_enabled` | `false` | Project Console availability; fails closed |
| `project_claims_enabled` | `false` | Project ownership claim submissions; fails closed |
| `project_corrections_enabled` | `false` | Project factual correction submissions; fails closed |

The existing `public.feature_flags` table already seeds one unique row for each key. Gate 7 adds no migration and preserves those defaults. `radar_auto_publish` remains false by default and fails closed.

## Typed server API

`src/lib/feature-flags/server.ts` exports the typed `FeatureFlagKey` catalogue and these read functions:

- `getFeatureFlag(key)` returns the typed key and boolean outcome, or `null` for an unsupported runtime key.
- `isFeatureEnabled(key)` returns the boolean outcome.
- `getFeatureFlags(keys)` returns only the requested boolean outcomes.
- `getSystemFeatureFlags()` returns the canonical system flag outcomes.

The API never returns database rows, configuration, timestamps, or `updated_by`.

## Server-only boundary

Reads use one isolated, lazily created Supabase client inside the server-only feature-flag module. It uses `SUPABASE_URL` and `SUPABASE_SECRET_KEY` only because the existing RLS policy intentionally keeps the full flag table out of anonymous/public Data API access. The client is not exported and is not a general database utility. No browser component, public payload, or client bundle receives the secret or administrative metadata.

## Failure behavior

Unknown keys return false through `isFeatureEnabled`. Missing rows use the safe per-key defaults. Database errors, malformed `enabled` values, and malformed configuration use those same defaults. A malformed or missing `radar_auto_publish` value can therefore never enable automatic publication. Maintenance mode defaults to restricted operation when unavailable.

## Freshness and caching

Flag rows are queried on each API call. The isolated client may be reused as a stateless connection helper, but flag results are not cached across requests or operations. No Redis, persistent cache, or long-lived flag snapshot is introduced. Later caching requires an explicit stale-state bound and kill-switch validation.

## Control hierarchy

Gate 7 implements only global system flags. Future effective availability composes:

`global system flag → section or placement state → individual content or campaign state`

For example, advertising will later require `advertising_enabled`, an enabled placement, an active in-window campaign, and an enabled creative/assignment. Gate 7 does not implement those domain state engines.

## Radar safety

`radar_enabled` controls public Radar availability. `radar_auto_publish` is independent and does not imply that Radar is enabled. Automatic publication remains subject to the later mandatory review, analysis eligibility, freshness, emergency pause, and audit requirements. Gate 7 does not publish Radar records or create analysis workflows.

## Maintenance mode

`maintenance_mode` is available to later server-rendered availability checks. Gate 7 does not add a maintenance page or change existing routes. Unavailable maintenance state is treated conservatively as restricted public operation, with authorized recovery access handled by later route logic.

## Future mutations and deferred work

Gate 7 exposes reads only. It creates no browser mutation, toggle endpoint, Server Action, or unaudited privileged write. Gate 8 must establish audit logging before a later gate adds controlled Admin flag mutations. Public page integration, section/placement logic, campaign scheduling, publication workflows, admin UI, analytics, and Radar execution remain deferred.
