# Kindling runbook

## Distinguishing “no results yet” from importer failure

On `/admin` Operations:

- `not_published_yet`, `outside_window`, or `season_inactive` → source/schedule, not a parser bug.
- `failed` / `http_error` / `exception` → importer failure. Check Edge logs with the request/run id.
- `needs_review` → unknown names or malformed alt text. Fix aliases, then recover.

## Importer recovery

1. Open `/admin` → Episode scores.
2. Paste image alt text (`Name total points: N; …`). Preview must parse before submit.
3. Recovery publishes a new revision. It never edits published rows in place.
4. Notification enqueue runs after publish. Push failure cannot roll back scores.

Manual **Check scores now** still works when the season is not `active`. Scheduled ticks do not.

## Score correction

Use another import or recovery for the same episode number. The RPC supersedes the previous published revision and enqueues spoiler-safe correction copy (`/standings`).

## Merge and boots

Do not invent a merge episode or boot list. Record them on `/admin` only after they are published. Without marked boots, merge treats all nine as alive and requires a swap.

## Push outbox

- Flush from `/admin` or wait for `kindling-process-outbox`.
- `missing_vapid` means Edge secrets are incomplete. Vault-only VAPID is not enough.
- `invalid_vapid` means the Edge private key is present but not importable PKCS8. Re-paste as a single line from `generate-vapid-keys.mjs`.
- Dead-letter count is on the Operations card. Expired endpoints are revoked on 404/410.

## Rate limits

`Too many attempts. Try again shortly.` on create league, invites, wildcard, admin claim, push register, or import runs. Limits are per authenticated user. Service-role cron is not throttled.

## Backups and disaster recovery

Use the hosted project’s automatic backups. Restore is a dashboard operation — do not run `supabase db reset` against hosted. After a restore, confirm cron jobs still exist and Vault names are intact.

## Alerts to watch

- Cron staleness: no `schedule` import run in 8 days after the season is active.
- Outstanding review count > 0 after Thursday night.
- Push dead-letter growth.
- Season still `upcoming` when you expected polling (`season_inactive` on scheduled invokes).
