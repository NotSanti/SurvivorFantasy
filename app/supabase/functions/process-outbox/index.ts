import { createClient } from 'npm:@supabase/supabase-js@2'
import { authorizeCronRequest } from '../_shared/cron-auth.ts'
import { logEvent, redactForLog, requestIdFrom } from '../_shared/redact.ts'
import {
  createVapidJwt,
  normalizeVapidPublicKey,
  resolveVapidSubject,
} from '../_shared/web-push-vapid.ts'
import { encryptWebPush, pushCopyFromOutbox, urlBase64ToBytes } from '../_shared/web-push-encrypt.ts'

const cors = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers':
    'authorization, x-client-info, apikey, content-type, x-cron-secret, x-request-id',
}

const MAX_ATTEMPTS = 8
const BACKOFF_SECONDS = [60, 120, 240, 480, 900, 1800, 3600]

function json(body: unknown, status = 200) {
  return new Response(JSON.stringify(body), {
    status,
    headers: { ...cors, 'Content-Type': 'application/json' },
  })
}

function redact(message: string) {
  return redactForLog(message)
}

function nextAvailable(attemptCount: number) {
  const index = Math.max(0, Math.min(BACKOFF_SECONDS.length - 1, attemptCount - 1))
  return new Date(Date.now() + BACKOFF_SECONDS[index] * 1000).toISOString()
}

async function importVapidPrivateKey(raw: string) {
  const normalized = raw.replace(/\s+/g, '')
  const bytes = urlBase64ToBytes(normalized)
  return crypto.subtle.importKey('pkcs8', bytes, { name: 'ECDSA', namedCurve: 'P-256' }, false, ['sign'])
}

Deno.serve(async (request) => {
  const requestId = requestIdFrom(request)
  if (request.method === 'OPTIONS') return new Response('ok', { headers: cors })
  if (request.method !== 'POST') return json({ error: 'Method not allowed' }, 405)

  const supabaseUrl = Deno.env.get('SUPABASE_URL')
  const serviceKey = Deno.env.get('SUPABASE_SERVICE_ROLE_KEY')
  const anonKey = Deno.env.get('ANON_KEY') ?? Deno.env.get('SUPABASE_ANON_KEY')
  const vapidPublic = normalizeVapidPublicKey(Deno.env.get('VAPID_PUBLIC_KEY') ?? '')
  const vapidPrivateRaw = Deno.env.get('VAPID_PRIVATE_KEY')
  const vapidSubject = resolveVapidSubject(Deno.env.get('VAPID_SUBJECT'))
  if (!supabaseUrl || !serviceKey || !anonKey) {
    return json({ error: 'Server is missing Supabase credentials' }, 500)
  }

  const cronAuth = authorizeCronRequest({
    expectedSecret: Deno.env.get('CRON_SECRET'),
    providedSecret: request.headers.get('x-cron-secret'),
  })
  const authHeader = request.headers.get('Authorization') ?? ''
  let allowed = cronAuth.ok
  if (!allowed) {
    const userClient = createClient(supabaseUrl, anonKey, {
      global: { headers: { Authorization: authHeader } },
    })
    const { data: isAdmin } = await userClient.rpc('is_admin')
    allowed = Boolean(isAdmin)
  }
  if (!allowed) {
    logEvent('process_outbox_denied', { request_id: requestId, code: cronAuth.code ?? 'not_admin' })
    return json({ error: 'Admin or cron secret required' }, 403)
  }

  if (!vapidPublic || !vapidPrivateRaw) {
    return json({ status: 'missing_vapid', detail: 'VAPID keys are not configured in Edge secrets.' }, 503)
  }

  let vapidPrivate: CryptoKey
  try {
    vapidPrivate = await importVapidPrivateKey(vapidPrivateRaw)
  } catch {
    logEvent('process_outbox_invalid_vapid', { request_id: requestId })
    return json({ status: 'invalid_vapid', detail: 'VAPID private key could not be imported.' }, 503)
  }

  const service = createClient(supabaseUrl, serviceKey)
  const { data: claimed, error: claimError } = await service.rpc('claim_notification_outbox', {
    p_limit: 25,
  })
  if (claimError) return json({ error: redact(claimError.message) }, 500)

  const jobs = claimed ?? []
  let sent = 0
  let retried = 0
  let dead = 0
  const deliveries: string[] = []

  for (const job of jobs) {
    try {
      const { data: subs, error: subError } = await service
        .from('push_subscriptions')
        .select('endpoint, p256dh, auth')
        .eq('user_id', job.user_id)
        .is('revoked_at', null)
      if (subError) throw subError

      const payload = pushCopyFromOutbox(job.event_type, (job.payload ?? {}) as Record<string, unknown>)
      const body = JSON.stringify(payload)
      let delivered = 0
      let failed = 0
      for (const sub of subs ?? []) {
        const host = new URL(sub.endpoint).host
        try {
          const audience = new URL(sub.endpoint).origin
          const token = await createVapidJwt({
            audience,
            subject: vapidSubject,
            privateKey: vapidPrivate,
          })
          const encrypted = await encryptWebPush({
            payload: body,
            p256dh: sub.p256dh,
            auth: sub.auth,
          })
          const response = await fetch(sub.endpoint, {
            method: 'POST',
            headers: {
              Authorization: `vapid t=${token}, k=${vapidPublic}`,
              TTL: '86400',
              Urgency: 'normal',
              'Content-Encoding': 'aes128gcm',
              'Content-Type': 'application/octet-stream',
            },
            body: encrypted,
          })
          const reason = (await response.text()).replace(/\s+/g, ' ').slice(0, 120)
          deliveries.push(`${host} ${response.status}${reason ? ` ${reason}` : ''}`)
          if (response.status === 404 || response.status === 410) {
            await service.rpc('revoke_push_endpoint', { p_endpoint: sub.endpoint })
            continue
          }
          if (!response.ok) {
            failed += 1
            continue
          }
          delivered += 1
        } catch (cause) {
          failed += 1
          deliveries.push(
            `${host} ${cause instanceof Error ? cause.message : 'send failed'}`,
          )
        }
      }

      if (delivered === 0 && failed > 0) {
        throw new Error(`Push rejected (${deliveries.slice(-failed).join('; ')})`)
      }
      if ((subs ?? []).length > 0 && delivered === 0) {
        throw new Error('No active push subscriptions for this user.')
      }

      await service.rpc('complete_notification_outbox', {
        p_id: job.id,
        p_status: 'sent',
      })
      sent += 1
    } catch (cause) {
      const attemptCount = Number(job.attempt_count ?? 1)
      const message = redact(cause instanceof Error ? cause.message : 'push failed')
      if (attemptCount >= MAX_ATTEMPTS) {
        await service.rpc('complete_notification_outbox', {
          p_id: job.id,
          p_status: 'dead_letter',
          p_error_redacted: message,
        })
        dead += 1
      } else {
        await service.rpc('complete_notification_outbox', {
          p_id: job.id,
          p_status: 'pending',
          p_error_redacted: message,
          p_available_at: nextAvailable(attemptCount),
        })
        retried += 1
      }
    }
  }

  logEvent('process_outbox_finished', {
    request_id: requestId,
    claimed: jobs.length,
    sent,
    retried,
    dead,
  })
  return json({
    status: 'processed',
    claimed: jobs.length,
    sent,
    retried,
    dead,
    detail: [
      `Claimed ${jobs.length}, sent ${sent}, dead-letter ${dead}.`,
      deliveries.length ? deliveries.map((item) => redact(item)).join('; ') : null,
    ]
      .filter(Boolean)
      .join(' '),
  })
})
