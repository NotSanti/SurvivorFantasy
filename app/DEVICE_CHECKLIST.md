# Physical-device checklist

Use the live app: https://kindling-theta.vercel.app

Sign in with your own magic-link inbox, or the dummy admin in `.env.local` (password grant).

Denying notification permission must leave the app fully usable.

## Chromium (Android or desktop)

1. Open the production URL over HTTPS.
2. After a tap, you should see an install prompt (or browser Install app).
3. Install, launch from the home screen / app icon.
4. Sign in. Open Activity → Notify me. Accept push.
5. Confirm a lock-screen/system notification can be received after an admin flush or a test outbox job.
6. Repeat with Notify me denied: Activity, standings, and draft still work.

## iOS / iPadOS 16.4+

1. Safari → Share → Add to Home Screen. Push is not available in Safari tabs.
2. Open Kindling from the home-screen icon (standalone).
3. Sign in. Activity → Notify me.
4. Accept: a later score/merge notification should open the same-origin route.
5. Deny: the rest of the camp still works. No permission prompt on first load.

## After the check

Record pass/fail in `IMPLEMENTATION_STATUS.md` Phase 9. Do not treat a denied-permission path as a product bug.
