# Admin Specification

## Scope

`/admin` is planned as a private operational dashboard. Hiding the route is not security; authentication and authorization must be server-side.

## Planned controls

Dashboard, global settings, homepage sections, navigation, Radar and its review queue, research/articles, Featured Partners, sponsors, advertising inventory, campaigns, creatives, leads, bookings, social/network links, analytics, users, roles, audit logs, and feature flags.

Frequently changed functionality should eventually be controllable without code changes. Homepage sections should be enableable, configurable, and ideally reorderable.

## System controls

Conceptual global controls: Website, Radar, Research, Advertising, Featured Partners, Bookings, Newsletter, and Maintenance Mode, each ON/OFF as appropriate. Control hierarchy is global system → section/placement → individual campaign/content state.

Radar controls: public Radar, automatic discovery, automatic analysis, automatic publishing (OFF by default), manual review required (ON), and emergency Radar pause (OFF by default).

Radar scores are calculated by the system and cannot be manually edited. Admins may hide, reject, flag, request reanalysis, and add editorial notes.

## Roles

The implemented initial roles are Owner, Admin, Editor, Radar Reviewer, Ad Manager, Analyst, and Viewer. Their read/admin-entry permission catalogue and restrictive mixed-role behavior are defined in [AUTHORIZATION_PLAN.md](AUTHORIZATION_PLAN.md); future mutation permissions remain separately gated.

## Gate 10 implementation

Gate 10 establishes the protected Admin shell only. The shell lives under the `/admin` route layout and uses the existing server-side `requireAdminAccess()` boundary. Unauthenticated requests redirect to the hardened login flow; authenticated users without active application membership receive an access-denied response with logout; authorization infrastructure failures fail closed.

### Route structure

The shell currently provides these read/structure-only routes:

```text
/admin
/admin/research
/admin/radar
/admin/partners
/admin/sponsors
/admin/advertising
/admin/campaigns
/admin/leads
/admin/bookings
/admin/network
/admin/feature-flags
/admin/settings
/admin/navigation
/admin/users
/admin/audit
```

The overview reads the existing Gate 7 global feature flags server-side and presents system/foundation status without mutation controls. The Feature Flags route reads the same canonical catalogue and explicitly states that mutation is deferred. Every other module route is a clearly marked foundation placeholder with no records or business workflow.

### Navigation and role behavior

Navigation is derived from the live authorization context's existing permission catalogue. Editor/Analyst/Viewer research access, Radar Reviewer/Analyst Radar access, Ad Manager commercial access, Owner/Admin configuration and directory access, and Viewer active-partner access follow the existing authorization plan. Items without an implemented permission model—Bookings, Network, and Audit Logs—are shown only to Owner/Admin as disabled planned items; they are not links or grants. Hidden navigation is UX only; direct route boundaries still call shared server authorization helpers.

### Responsive shell and accessibility

Desktop uses a compact left navigation and a focused main content region. At mobile widths the sidebar is replaced with an accessible `Sections` disclosure using `aria-expanded`, `aria-controls`, semantic navigation landmarks, current-page indication, visible focus states, and the existing reduced-motion foundation. The shell avoids raw identity tokens and shows only safe role labels plus logout.

### Deferred operations

Gate 10 creates no Server Actions, mutation endpoints, toggles, role assignment, article editing, Radar moderation, sponsor/campaign editing, settings editing, navigation editing, analytics, or audit-log reader. Audit infrastructure remains active but its records stay closed. Future mutations must be named, permission-checked, validated, and persisted through the required audited path.

## Gate 18D Research operations

Research is the first operational Admin content module. Its request-time routes are `/admin/research`, `/admin/research/new`, `/admin/research/[id]`, and `/admin/research/[id]/preview`. The list is filtered by the existing Research read permissions and RLS, with honest state groupings and revision information rather than invented metrics.

The editor uses native form controls and the Gate 18B closed structured block contract. Draft saves, classification changes, author assignments, lifecycle transitions, and token option searches are thin adapters over the exact named RPCs. Each Server Action rechecks identity and current application roles; database authorization, validation, optimistic revision checks, and atomic audit logging remain authoritative. No Server Action imports the secret-key audit writer, performs direct article DML, or exposes auth email/private profile data.

Publication UX is deliberately explicit: Draft → Scheduled requires a future timestamp and publishability checks; Publish is a separate confirmed action; Archive, Restore → Draft, and other reason-bearing transitions require a reason. The preview is protected by the Admin layout, noindex, and visibly marked `PREVIEW · UNPUBLISHED · NOT INDEXED`; it emits no Article JSON-LD. There is no autosave, media upload, automatic scheduler, arbitrary HTML, hard delete, or remote integration in this gate. Gate 18E is not started.
