# UI Creative Pass — Scope

| Field | Value |
| --- | --- |
| Status | **SCOPED for FE** |
| Baseline | `main` @ `525f652` |
| Branch | `ui/creative-pass-v1` (off `main`) |
| Owner chain | Lead (scope) → FE (implement) → QA (a11y + honesty) → Lead (approve) → user OK to merge |
| Nature | **Creative visual polish** on existing surfaces — not a product rebuild |
| Campaign Studio / Phase 2 | **OUT** |

Companion brief: Supervisor creative UI post in Project V2 (competitor pattern steal-list + locked positioning). Design canon: `docs/DESIGN_SYSTEM.md`.

---

## 1. Positioning (locked)

Premium **financial intelligence terminal × modern crypto publication**.

Directional feel (adapt, do not clone): Bloomberg depth × Linear craft × Messari editorial calm.

**Not:** neon Web3, casino/memecoin landers, generic SaaS, fake charts, glassmorphism soup, black/gold cliché.

---

## 2. Steal patterns (adapt only)

| Reference | Steal | Do not steal |
| --- | --- | --- |
| Nansen screener | Dense sortable calm, clear filters, mode toggles | Neon trader chrome |
| Token Terminal | Institutional metric hierarchy, quiet confidence | Generic fund-dashboard clichés |
| Messari | Research-first IA; screener vs publication split | Blurring paid into editorial |
| DEX Screener / Birdeye | Freshness urgency labels | Candlestick casino UI |
| Amberdata-class critique | Differentiate via provenance + craft | Same red/green board as everyone |

**Win lane:** provenance badges, disclosure honesty, typographic craft, restrained mint accent.

---

## 3. In scope (tickets)

### UCP-0 — Branch + baseline hygiene
- Branch from `525f652`; confirm freezes untouched.
- **AC:** clean branch; no freeze-path files in first commit.

### UCP-1 — Homepage “intelligence desk”
- Files: `src/components/home/**`, `src/components/public/public-shell.tsx`, `public-header.tsx`, related tokens in `globals.css` / `src/components/ui/primitives.tsx`.
- Editorial hero + desk modules (Radar pulse strip, Research strip, commercial rail marked **SPONSORED**).
- **AC:** clearer hierarchy; SPONSORED ≠ organic; no fabricated metrics; mobile + desktop; reuse primitives.

### UCP-2 — Radar list as instrument panel
- Files: `src/components/radar/**`, public radar pages.
- Denser but breathable rows; monospace for numbers; freshness / risk / evidence as distinct meaning columns.
- Honest empty / UNAVAILABLE / UNKNOWN (no fake fills).
- **AC:** no watcher/fixtures/shadow-collect edits; no score formula changes; a11y table/list semantics.

### UCP-3 — Trust discoverability
- Files: `src/components/trust/**`, `public-header.tsx` / footer.
- Methodology + Disclosures reachable from desktop nav (and mobile).
- **AC:** no copy that implies Analyzer public / AI / paid verification.

### UCP-4 — Project Console ops-grade polish
- Files: `src/components/project-console/**`, `(project-console)/**`.
- Claimed-project workspace feels ops desk, not marketing form farm; truthful `NO_DATA` / `COMING_SOON` / disabled empties.
- **AC:** no Campaign Studio; Analytics/Campaigns remain honest empties; flags fail-closed.

### UCP-5 — Token / CTA consistency (light)
- Kill stray hardcoded greens (e.g. `#11201a`-class misses); align primary CTA widths/heights to design tokens (≥44px interactive where Gate B parked items aren’t regressing).
- **AC:** prefer CSS variables; no new color system rewrite.

### UCP-6 — FE handoff pack
- Screenshots before/after (home, radar, trust nav, console overview); `pnpm lint` / typecheck / build green; note freezes held.

---

## 4. Out of scope

- Campaign Studio / Phase 2 entitlements  
- Radar watcher, fixtures, shadow-collect, scoring/methodology mutations  
- Analyzer public / AI / methodology activation  
- Trading / custody / execution  
- Fabricated metrics, client logos, traffic claims  
- Sanity CMS / greenfield redesign  
- Merging Gate B a11y branch (still parked; do not regress skip/focus if already on main from other work)  
- Recreating commercial tables  

---

## 5. Freezes (must hold)

1. Radar watcher / fixtures / shadow-collect / score integrity  
2. Analyzer public + AI + methodology OFF  
3. Trading  
4. Commercial ↔ intelligence firewall (UI must keep SPONSORED / EDITORIAL / evidence distinct)  
5. No merge to `main` without Lead + QA + **user OK**

---

## 6. QA bar (after FE)

- Visual: matches positioning; no neon/casino  
- Honesty: no fake charts/numbers; empties truthful  
- A11y: focus visible, contrast, nav keyboard, ≥44px where touched  
- Diff: freeze paths clean  
- Lint / typecheck / build green  

---

## 7. Delivery

1. FE implements UCP-0→UCP-6 on `ui/creative-pass-v1`  
2. Push feature branch OK; **no merge-ready claim** until QA PASS + Lead approve + user OK  
3. QA reviews; Lead approves; user OK to merge  

*End scope. Baseline `525f652`.*
