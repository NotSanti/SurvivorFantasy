# Web Push compatibility spike (Phase 1)

**Date:** 2026-09-09  
**Decision:** keep standards-based Web Push; do not add a third-party push vendor.

## What was tested

- VAPID ES256 JWT creation via Web Crypto (`src/domain/web-push-vapid.ts`) in Node 24 / Vitest.
- A Deno-shaped Edge Function at `supabase/functions/push-spike` that uses the same Web Crypto approach.

## Result

- Web Crypto ECDSA P-256 signing works in the test runtime without the Node `web-push` package.
- `web-push` is Node-oriented (`https`, native crypto helpers) and should not be imported into Supabase Edge Functions.
- Local Supabase is not initialized until Phase 2, so this function was not deployed. Deploy/serve it after `supabase start` and confirm Deno.serve + Web Crypto in the Edge runtime.

## Follow-up

- Phase 2: `supabase start` and invoke `push-spike` locally.
- Phase 9: production outbox sender using this Web Crypto path, VAPID keys in secrets, public key only in `VITE_VAPID_PUBLIC_KEY`.
- If Edge runtime crypto later fails, pause for **USER DECISION REQUIRED** before adding a push vendor.
