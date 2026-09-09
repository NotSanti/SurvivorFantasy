# Kindling deployment

Hosted database: [ryzueuyypmdkqfufdpzs](https://supabase.com/dashboard/project/ryzueuyypmdkqfufdpzs)  
API URL: `https://ryzueuyypmdkqfufdpzs.supabase.co`

## Client (Vercel)

Set these **public** variables only:

- `VITE_SUPABASE_URL`
- `VITE_SUPABASE_ANON_KEY` (or the current publishable key)
- `VITE_VAPID_PUBLIC_KEY`

Never set `SUPABASE_SERVICE_ROLE_KEY`, `VAPID_PRIVATE_KEY`, `VAPID_SUBJECT`, or `CRON_SECRET` as `VITE_*` or in the Vercel client env.

Auth redirect URLs must include:

- `http://127.0.0.1:5173/auth/callback`
- preview `4173` if used
- the production origin `/auth/callback`

`vercel.json` ships CSP and security headers compatible with Supabase Realtime (`https` + `wss` to `*.supabase.co`) and the same-origin service worker.

## Supabase secrets

### Vault (pg_cron / pg_net)

Required names (no values in git):

- `project_url`
- `anon_key`
- `CRON_SECRET`

Optional Vault copies of `VAPID_PRIVATE_KEY` and `VAPID_SUBJECT` are fine for backup. Cron SQL reads Vault; it never embeds keys.

### Edge Function secrets

`process-outbox` and `import-scores` read **Edge** env, not Vault:

- `CRON_SECRET` (must match Vault)
- `VAPID_PUBLIC_KEY`
- `VAPID_PRIVATE_KEY` (PKCS8 url-safe base64 from `node scripts/generate-vapid-keys.mjs`; paste as one line)
- `VAPID_SUBJECT` (`mailto:` a monitored inbox, or `https://…`)

`process-outbox` strips wrapping whitespace in the private key. A successful empty flush returns `{ status: "processed", claimed: 0 }`. `missing_vapid` means an Edge secret is still unset.

## Schema

Apply `app/supabase/migrations/` through the hosted SQL editor or Supabase MCP `apply_migration`. After an MCP apply, also insert the **local file version** into `supabase_migrations.schema_migrations` (for example `20260909038000`).

Regenerate `src/types/database.ts` from the hosted project. Do not use `supabase start` / `db reset` as the source of truth.

## Cron

Jobs live in [Cron](https://supabase.com/dashboard/project/ryzueuyypmdkqfufdpzs/integrations/cron/jobs):

| Job | UTC schedule |
| --- | --- |
| `kindling-import-scores-thu` | `*/15 22-23 * * 4` |
| `kindling-import-scores-fri-early` | `*/15 0-5 * * 5` |
| `kindling-import-scores-fri-day` | `0 16,19 * * 5` |
| `kindling-process-outbox` | `*/15 * * * *` |

The Edge function still no-ops unless Toronto local time is in the results window and Season 51 `status = active`. Do not flip the season to active until you intend live polling.

## Rollback

1. Pause the four `kindling-*` cron jobs.
2. Redeploy the previous Edge Function version for `import-scores` / `process-outbox`.
3. Do not roll back published score revisions in place. Publish a new revision instead (see `RUNBOOK.md`).
4. Client rollback is a Vercel redeploy of the previous production deployment.
