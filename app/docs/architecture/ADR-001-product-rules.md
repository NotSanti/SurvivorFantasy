# ADR-001 — Product rules, source of truth, and shared-pool selection

**Status:** accepted for v1  
**Date:** 2026-09-09  
**Context:** Survivor 51 Fantasy League implementation plan §2–§3

## Decision

Kindling is an unofficial, fan-made private fantasy league for Survivor 51. Global TV’s Fantasy Tribe page is the rules and weekly-score authority. The v1 product uses independent shared-pool rosters, not an exclusive snake draft.

## Product identity

- **App name:** Kindling
- **Short name:** Kindling
- **Disclaimer (required in UI):** “Unofficial fan-made fantasy game. Not affiliated with or endorsed by Survivor, CBS, Corus, or Global.”
- Visual identity is original. Do not copy Global/CBS branding, logos, article text, or cast photography without confirmed permission.

## Source of truth

- Rules and published per-castaway episode totals come from Global TV.
- Season 50 Fantasy Tribe rules are seeded as the **provisional** rule-set version, labeled pending Season 51 confirmation.
- Confirmed Season 51 facts as of 2026-09-09: 21 castaways; premiere Wednesday, September 23, 2026 at 8 p.m. ET/PT; weekly 90-minute episodes starting September 30.
- Posted names were imported from the [survivorstatsdb Season 51 castaways tab](https://www.survivorstatsdb.com/season?vs=US51&tab=tab-castaways). Original tribe membership is not posted there (Savu and Toka are named, but who is on which tribe is not), so Kindling stores names without `original_tribe_id` until a source publishes assignments.
- Global’s Season 51 Fantasy Tribe page was not published at the expected slug when this ADR was written. Do not treat Season 50 roster quotas, Episode 2 scoring start, merge handling, category list, or Thursday release time as immutable Season 51 facts.
- When the Season 51 page appears, an admin sync/diff workflow proposes a new rule-set version. Only an authorized confirmation path activates it.

## Selection mode: `global_shared_pool`

Global’s source page describes independent fantasy rosters. It does not define an exclusive player pool, snake order, timers, or a rule preventing two friends from selecting the same castaway. An exclusive nine-player roster would also cap a 21-person season at two fantasy managers.

v1 therefore:

- Allows league members to own the same castaway.
- Calls the in-app flow the **Draft Room**, but it is private roster selection, not a snake draft.
- Requires eight manual picks with a `3 / 3 / 2` distribution across original tribes.
- Assigns the ninth slot as a server-selected wildcard, uniformly from the underfilled tribe, yielding `3 / 3 / 3`.
- Lets each member choose an MVP from the completed nine-person roster, including the wildcard.
- Keeps picks hidden from other members until the league locks.
- Stores `selection_mode` as an enum so `exclusive_snake` can be added later. Do not implement exclusive snake in v1.

Wildcard selection is server-side, atomic, replay-safe, idempotent, audited, and never rerollable. See the implementation plan §3 wildcard fairness contract.

If Season 51 publishes different quotas, configuration and validation must adapt without a schema rewrite.

## Locked v1 product decisions

| Area | v1 decision |
| --- | --- |
| Authentication | Supabase Auth with email magic link/OTP; keep provider abstraction open for OAuth later |
| League privacy | Private, invite-only leagues |
| League size | Configurable 2–20 members; independent rosters allow normal-sized groups |
| League roles | One commissioner plus members; transfer-of-commissioner waits until after MVP |
| Draft/selection | Shared pool, eight manual picks plus one server-selected wildcard, then MVP selection |
| Pick visibility | Own picks visible during selection; all rosters visible once league is locked |
| Start condition | Commissioner can lock after every active member is ready; optional deadline can auto-lock only if every member is valid |
| Late joining | Disabled after selection begins |
| Wildcard rerolls | Never allowed; selection is idempotent and audit logged |
| Scoring authority | Imported Global per-castaway episode totals, not crowdsourced event interpretation |
| Corrections | Global corrections replace the affected episode score with an auditable revision and recompute totals |
| MVP | One original-roster castaway; locked with roster; 30 extra points only if the MVP wins |
| Merge move | One add if fewer than nine active entries, otherwise one swap; effective next episode; one transaction per member |
| Notifications | In-app notification center plus standards-based Web Push; user-configurable categories |
| Realtime | Supabase Realtime invalidates relevant cached league/score queries; authoritative totals still come from Postgres |
| Offline | App shell and last successful read are available; draft, join, and commissioner mutations require connectivity |
| Animation | Motion for routine UI/layout transitions; lazy-load anime.js only for a distinctive wildcard reveal or celebration |
| Admin | Minimal protected operations area for source sync, aliases, import diffs, manual recovery, and notification status |
| Public disclaimer | Unofficial fan-made disclaimer as specified above |

## Consequences

- Business rules live in typed domain modules and/or transactional database functions, not React components.
- Schema includes `selection_mode` even though only `global_shared_pool` is implemented.
- Rule-sets are versioned. Season 50-derived scoring is `draft` / pending confirmation until an admin confirms Season 51 source content.
- Scoring publication is independent from notification delivery so a push failure cannot roll back scores.
