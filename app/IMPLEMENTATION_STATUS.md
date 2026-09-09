# Kindling — Implementation status

**Product:** Kindling (unofficial Survivor 51 fantasy league PWA)  
**Plan:** `SURVIVOR_51_FANTASY_LEAGUE_IMPLEMENTATION_PLAN.md`  
**Package manager:** npm (`package-lock.json`)  
**App root:** `app/`

---

## Baseline (Phase 0)

Recorded 2026-09-09.

### Repository

- Git repo at `SurvivorFantasy/` with a single untracked `app/` directory. No commits yet.
- `app/` began as a default Vite + React 19 + TypeScript template.
- Package manager is npm. Do not switch to pnpm unless asked.
- Implementation plan is present at `app/SURVIVOR_51_FANTASY_LEAGUE_IMPLEMENTATION_PLAN.md`.

### Existing scripts at audit

| Script | Present | Baseline result |
| --- | --- | --- |
| `npm run lint` | yes | pass |
| `npm run build` | yes | pass |
| `npm run typecheck` | no | n/a |
| `npm test` | no | n/a |
| `npm run test:db` | no | n/a |
| `npm run test:e2e` | no | n/a |

### Decisions recorded

- ADR-001: shared-pool selection, provisional Season 50 rules, product name Kindling.

---

## Phase checklist

- [x] Phase 0 — Repository audit and decision record
- [x] Phase 1 — Foundation, design system, and technical spikes
- [x] Phase 2 — Supabase schema, types, RLS, and local seed data
- [x] Phase 3 — Authentication, profiles, league creation, invites, and lobby
- [x] Phase 4 — Rules synchronization and admin confirmation
- [x] Phase 5 — Draft Room, wildcard, MVP, and league lock
- [x] Phase 6 — Episode score importer and revision pipeline
- [x] Phase 7 — Standings, weekly dashboard, team history, and Realtime
- [x] Phase 8 — Merge bonus/add-or-swap workflow
- [x] Phase 9 — PWA install, offline UX, Push, and notification outbox (device checklist still pending)
- [x] Phase 10 — Scheduling, operations, observability, and security hardening
- [ ] Phase 11 — Full QA, performance, accessibility, and deployment readiness (docs started; E2E/device blocked)
- [ ] Phase 12 — Final handoff

---

## Phase notes

### Phase 0

- Commands: `npm run lint` (pass), `npm run build` (pass).
- Created `docs/architecture/ADR-001-product-rules.md`, `.env.example`, this status file.

### Phase 1

- Installed Tailwind v4, shadcn/ui (Radix), React Router, TanStack Query, Zod, RHF, Motion, Vitest, RTL, MSW, Playwright, vite-plugin-pwa, Supabase JS.
- Kindling dark pine/ember tokens; original icons; unofficial disclaimer on welcome and shell.
- App shell with bottom nav, error boundary, toast, loading/empty/error/offline/permission states, reduced-motion CSS.
- Typed env parsing in `src/domain/env.ts` (fails clearly when Supabase is required).
- Custom service worker with push/notificationclick handlers and same-origin deep-link parsing.
- Web Push spike: Web Crypto VAPID JWT in Node tests; Deno Edge function stub. `web-push` npm package not used. Not deployed (local Supabase starts in Phase 2).
- anime.js not installed (deferred to wildcard reveal).
- `eslint-plugin-jsx-a11y` skipped: peer eslint@^9, project is eslint 10.

Commands:

| Check | Result |
| --- | --- |
| `npm run lint` | pass |
| `npm run typecheck` | pass |
| `npm test` | pass (14 tests) |
| `npm run build` | pass; `dist/manifest.webmanifest` + `dist/sw.js` |
| secret scan of dist | no service-role / VAPID private / cron secret |
| `npm run test:e2e` | pass (Chromium Pixel 7 smoke) |

### Phase 2

- Local Supabase on ports 55421–55427 because default 54321–54327 are used by another project (`doomsday`).
- Schema, RLS, security-invoker views, profile trigger, and Season 51 provisional seed (draft rules). Cast names were added later from survivorstatsdb; original tribes remain unpublished.
- pgTAP: 13 tests for anon/non-member/cross-league/hidden picks/direct-write denial/locked visibility.
- Generated `src/types/database.ts`. Local `.env.local` holds the public anon key only (gitignored).

Commands:

| Check | Result |
| --- | --- |
| `supabase db reset` | pass |
| `npm run test:db` | pass (13) |
| `npm run lint` | pass |
| `npm run typecheck` | pass |
| `npm test` | pass (14) |

### Phase 3

- Magic-link welcome, `/auth/callback` (preserves `next` for invite return), and camp-name onboarding.
- RPCs: `create_league`, invite create/revoke/accept, `set_league_ready`, `complete_onboarding`, `leave_league`, `archive_league`, `start_league_selection`.
- Lobby: member names, ready, invite share/revoke, start selection, leave, archive.
- Invite failures mapped for expired, revoked, full, closed, invalid, and missing token.
- pgTAP: outsider isolation, last-seat/full, already-member, revoked, expired, commissioner leave rules.
- Playwright: two members share one league; an outsider cannot open it and can create a separate league.

Hosted project [ryzueuyypmdkqfufdpzs](https://supabase.com/dashboard/project/ryzueuyypmdkqfufdpzs) is the database under test. Local Supabase is no longer used. CLI `supabase link` still fails for the logged-in CLI account; migrations and types go through the Supabase MCP. Add Auth redirect URLs for `http://127.0.0.1:5173/auth/callback` (and preview `4173`) in the hosted Auth dashboard so magic links work.

League-lifecycle Playwright tests skip unless `E2E_SUPABASE_SERVICE_ROLE` is set (never `VITE_*`).

### Phase 4

- WP REST discovery for `survivor-51-fantasy-tribe`, HTML fallback, fail-closed parser, admin `/admin` confirm, alias RPC without invented castaways.
- Edge function `sync-rules` deployed with JWT required. Unauthenticated POST returns 401.
- Hosted Season 51 source is still unpublished (`not_published_yet`).

### Phase 5

- Draft Room at `/leagues/:id/draft`: 3/3/2 quotas from the active rule set, hidden picks until lock, idempotent `uniform-v1` wildcard, MVP from the nine, ready, commissioner lock.
- Season 51 now has the 21 posted names (survivorstatsdb US51). Original tribe membership is unpublished, so the room lists the cast with picks locked until Savu/Toka assignments can be imported without guessing. Domain tests cover quota and error mapping.

### Phase 6

- Parser reads `#results`, `EPISODE N POINTS` headings, and semicolon `Name total points: N` alt text. Exact aliases only; unknown/duplicate/malformed fail closed.
- Hosted RPCs publish versioned revisions, supersede corrections, and enqueue in-app/outbox notifications in a separate step so push failure cannot roll back scores.
- Edge function `import-scores` is deployed with JWT required. Admin `/admin` has Check scores now plus manual recovery.
- Season 51 aliases are seeded from posted first/full names. A live Global check can still no-op until that page publishes scores.

### Phase 7

- Roster-aware views honor `starts_episode`/`ends_episode`. MVP bonus is added only on an explicit finale when `final_placement = 1`. Tied totals share a rank; names only sort the list.
- League home, My Tribe (current + historical entries), standings with movement, episode detail, and a rules version page. Spoiler toggle hides the latest episode. Last-updated and corrected badges included.
- Bottom nav `/league`, `/tribe`, `/standings` follow the last opened league. Realtime on episodes, score revisions, roster, MVP, and leagues only invalidates TanStack Query keys.
- League members can read their attached rule-set even while it is still `draft`.

Commands:

| Check | Result |
| --- | --- |
| `npm run test:db` | skip (local stack retired) |
| `npm run lint` | pass |
| `npm run typecheck` | pass |
| `npm test` | pass |
| `npm run test:e2e` | welcome + signed-out route smoke; league lifecycle skipped without service role |

### Phase 8

- Merge window opens only after an admin records `seasons.merge_episode_number`. Kindling does not guess merge or boots.
- Alive roster at the merge episode decides add vs swap. Incoming starts scoring on merge+1. Historical points stay. One move per member.
- RPCs: `set_season_merge_episode`, `mark_castaway_eliminated`, `submit_merge_move`, `close_merge_window`. Published episode `>= merge+1` auto-closes the window.
- UI: `/league/merge` with confirmation, locked history, commissioner progress. Admin merge/boot controls on `/admin`.
- Realtime now also watches `merge_moves` and `seasons`.

Commands:

| Check | Result |
| --- | --- |
| `npm run lint` | pass |
| `npm run typecheck` | pass |
| `npm test` | pass (66 after Phase 8; 75 after Phase 9 domain) |

### Phase 9

- Install education: Chromium `beforeinstallprompt` after a tap; iOS Share → Add to Home Screen. Push is never requested on first load.
- Activity: in-app notifications, preference toggles including merge window, Notify me subscription via `register_push_subscription`.
- Outbox claim/complete RPCs are service-role only. `process-outbox` Edge Function is deployed with JWT required. Lock-screen score copy is spoiler-safe (no names, no totals).
- Unread badge on Activity plus `setAppBadge` where supported.

Vault holds `project_url`, `anon_key`, `CRON_SECRET`, `VAPID_PRIVATE_KEY`, and `VAPID_SUBJECT`. Client `.env.local` has `VITE_VAPID_PUBLIC_KEY`. Edge Function secrets now include `VAPID_PUBLIC_KEY`, `VAPID_PRIVATE_KEY`, and `VAPID_SUBJECT`. A wrapped newline in the private key caused `process-outbox` to 500 on base64 decode; the decoder now strips whitespace, and a cron invoke returns `processed`.

**USER DECISION REQUIRED** before live Web Push:

1. Physical-device checklist: iOS/iPadOS 16.4+ Home Screen install + Notify me; at least one Chromium install/push. Denying permission must leave the app usable.

Commands:

| Check | Result |
| --- | --- |
| `npm run lint` | pass |
| `npm run typecheck` | pass |
| `npm test` | pass (90 after Phase 10) |

### Phase 10

- Toronto results window (`America/Toronto`): Thursday 18:00–Friday 05:59 plus Friday 12:00–17:59 fallback. DST covered in unit tests.
- `import-scores` accepts admin JWT or `x-cron-secret`. Scheduled ticks no-op outside the window and when Season 51 is not `active`. A live Vault cron invoke returned `season_inactive`.
- `pg_cron` jobs (UTC): Thu 22–23 and Fri 00–05 every 15 minutes, Fri 16:00/19:00 fallback, `process-outbox` every 15 minutes. Jobs call `app_private.invoke_edge_function` and read Vault names `project_url`, `anon_key`, `CRON_SECRET`.
- Admin `/admin` health cards: last source check, last success, next expected episode, outstanding review, push failures, cron staleness. `not_published_yet` is classified as no-result-yet, not failure.
- Rate limits on create league, invite create/accept, wildcard, claim-admin, push register, and manual import runs.
- CSP + security headers in Vite and `vercel.json`. Secret scan script skips expected public anon JWTs in `dist`.
- Forged cron, SSRF allowlist, malicious HTML, invite-token redaction, and Realtime/RPC boundary tests added.

Commands:

| Check | Result |
| --- | --- |
| `npm run lint` | pass |
| `npm run typecheck` | pass |
| `npm test` | pass (90) |
| `npm run scan:secrets` | pass (source; dist public anon JWT ignored) |
| hosted cron invoke `process-outbox` | 200 `processed` (claimed 0) |
| hosted cron invoke `import-scores` | 200 `season_inactive` |

### Phase 11

- `DEPLOYMENT.md` and `RUNBOOK.md` cover env, Vault vs Edge secrets, cron, rollback, importer recovery, and corrections.
- Dummy admin `kindling.admin.test@example.com` can password-sign-in from Welcome (password in gitignored `.env.local`). `/admin` Operations cards load.
- Vercel project `kindling` is live at https://kindling-theta.vercel.app (Vite, root `app`, production public; Vercel Authentication is preview-only).
- Deterministic league-lifecycle E2E still skips without `E2E_SUPABASE_SERVICE_ROLE`.
- Physical-device a11y/install/push checklist can now run against the production URL.
- Season 51 Global source page is still unpublished; do not invent rules, merge, or boots.

**USER DECISION REQUIRED** to finish Phase 11–12: optional service-role for E2E, and device checks.
