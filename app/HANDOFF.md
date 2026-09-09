# Kindling — Phase 12 handoff

**Date:** 2026-09-09  
**Production:** https://kindling-theta.vercel.app  
**Repo:** https://github.com/NotSanti/SurvivorFantasy  
**Hosted database:** https://supabase.com/dashboard/project/ryzueuyypmdkqfufdpzs

## Completed

- Private fantasy PWA: auth (magic link + optional password), onboarding, leagues, invites, shared-pool draft (`3/3/2` + server wildcard → `3/3/3` + MVP), lock, standings, merge add/swap, in-app notifications, Web Push outbox.
- Season 51 cast of 21 names is seeded. Original tribe membership is unpublished, so `original_tribe_id` is null.
- Rules and scores are imported from Global when the source page exists. Season 51 is still `upcoming`; scheduled imports return `season_inactive`.
- Admin `/admin`: rules sync, aliases, merge episode (do not invent), scores, push flush, operations health.
- Edge functions `import-scores` and `process-outbox` are deployed. Cron + Vault invoke works. VAPID Edge secrets are set; empty outbox flush returns `processed`.
- Vercel project `kindling` is linked to this repo (`app/` root). Git pushes to `main` deploy production. Vercel Authentication is preview-only.
- Client env on Vercel: `VITE_APP_NAME`, `VITE_SUPABASE_URL`, `VITE_SUPABASE_ANON_KEY`, `VITE_VAPID_PUBLIC_KEY`.
- Dummy admin: `kindling.admin.test@example.com` (password in gitignored `app/.env.local`).

## Not claimed / still manual

- Physical iOS/iPadOS 16.4+ Home Screen install + Notify me. See `DEVICE_CHECKLIST.md`.
- Chromium install + push on a real device. Same checklist.
- League-lifecycle Playwright against hosted Auth Admin (`E2E_SUPABASE_SERVICE_ROLE`). Do not put the service role in `VITE_*`.
- Local `npm run test:db` is skipped; hosted Supabase is the source of truth.
- Lighthouse on a throttled mobile profile was not run in this pass.

## Season 51 source

Global has not published the Season 51 Fantasy Tribe rules/results page. Do not invent tribes, merge episode, or boots.

When Global publishes:

1. Confirm the page URL and add it as the season `source_page_url` if needed.
2. Run rules sync on `/admin`. Confirm the draft only after it matches Global.
3. Record boots and merge episode on `/admin` only after they air/publish.
4. Flip season status to `active` only when you want Thursday polling.

Authority: [Survivor 50 Fantasy Tribe](https://www.globaltv.com/survivor-50-fantasy-tribe/) (provisional rules) and Global’s Season 51 cast post.

## Advisors reviewed

- `SECURITY DEFINER` RPCs callable by `authenticated` are intentional; each function checks membership/admin inside.
- `audit_log`, `notification_outbox`, and `score_events` have RLS and no client policies (service-role / definer only).
- Unused / missing FK indexes are expected on a nearly empty hosted DB. Do not add a large index migration until import volume exists.
- Enable Auth leaked-password protection in the Supabase dashboard if you want HaveIBeenPwned checks (optional).

## Deferred (plan §15)

Snake draft, trades, public leaderboards, chat, cash/gambling, native wrappers, OCR/AI scoring.

## Exact next actions

1. Add production redirect URLs in [Supabase Auth](https://supabase.com/dashboard/project/ryzueuyypmdkqfufdpzs/auth/url-configuration):  
   `https://kindling-theta.vercel.app/auth/callback` and  
   `https://kindling-notsantis-projects.vercel.app/auth/callback`.  
   Set Site URL to `https://kindling-theta.vercel.app`.
2. Run `DEVICE_CHECKLIST.md` on one iPhone/iPad and one Chromium browser.
3. When Global publishes Season 51 rules/results, sync and confirm — do not activate the season until then.
