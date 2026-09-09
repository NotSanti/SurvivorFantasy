import { createVapidJwt, generateVapidKeys } from '../_shared/web-push-vapid.ts'

Deno.serve(async () => {
  const keys = await generateVapidKeys()
  const token = await createVapidJwt({
    audience: 'https://web-push-spike.invalid',
    subject: 'mailto:ops@kindling.example',
    privateKey: keys.privateKey,
  })

  return Response.json({
    ok: true,
    runtime: 'supabase-edge-deno',
    algorithm: 'ES256',
    tokenParts: token.split('.').length,
    notes: [
      'This spike uses Web Crypto only.',
      'Do not use the Node web-push package in Edge Functions.',
      'A third-party push vendor is not approved for v1.',
    ],
  })
})
