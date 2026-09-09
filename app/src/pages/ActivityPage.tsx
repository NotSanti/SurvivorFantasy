import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query'
import { useEffect, useMemo, useState } from 'react'
import { Link } from 'react-router'
import { EmptyState } from '@/components/states/EmptyState'
import { ErrorState } from '@/components/states/ErrorState'
import { LoadingState } from '@/components/states/LoadingState'
import { PageContainer } from '@/components/layout/PageContainer'
import { Alert, AlertDescription, AlertTitle } from '@/components/ui/alert'
import { Button } from '@/components/ui/button'
import { pushGate, readInstallSnapshot, type NotificationPermissionState } from '@/domain/pwa/install'
import {
  clientErrorMessage,
  ensurePushSubscription,
  serializePushSubscription,
  waitForPushRegistration,
} from '@/domain/push/subscribe'
import { useAuth } from '@/features/auth/use-auth'
import { useNotifications } from '@/hooks/use-notifications'
import { readViteEnv } from '@/lib/client-env'
import { getSupabaseClient } from '@/lib/supabase'
import type { Database } from '@/types/database'

const PREF_FIELDS = [
  { key: 'scores_published', label: 'Scores published' },
  { key: 'score_corrections', label: 'Score corrections' },
  { key: 'merge_window', label: 'Merge window' },
  { key: 'draft_deadlines', label: 'Draft deadlines' },
  { key: 'league_updates', label: 'League updates' },
  { key: 'weekly_reminder', label: 'Weekly reminder' },
] as const

async function persistPushSubscription(subscription: {
  endpoint: string
  toJSON?: () => { endpoint?: string; keys?: { p256dh?: string; auth?: string } }
  getKey?: (name: 'p256dh' | 'auth') => ArrayBuffer | null
}) {
  const keys = serializePushSubscription(subscription)
  const { error } = await getSupabaseClient().rpc('register_push_subscription', {
    p_endpoint: keys.endpoint,
    p_p256dh: keys.p256dh,
    p_auth: keys.auth,
    p_user_agent: navigator.userAgent,
  })
  if (error) throw error
}

export function ActivityPage() {
  const { user } = useAuth()
  const queryClient = useQueryClient()
  const notifications = useNotifications()
  const [pushError, setPushError] = useState<string | null>(null)
  const [pushOk, setPushOk] = useState(false)
  const [permission, setPermission] = useState<NotificationPermissionState>(
    typeof Notification === 'undefined' ? 'unsupported' : Notification.permission,
  )
  const vapidPublic = readViteEnv().VITE_VAPID_PUBLIC_KEY
  const gate = useMemo(() => {
    if (typeof window === 'undefined') return { kind: 'unsupported' as const }
    return pushGate(
      readInstallSnapshot({
        userAgent: navigator.userAgent,
        standaloneMedia: window.matchMedia('(display-mode: standalone)').matches,
        iosStandalone:
          'standalone' in navigator &&
          Boolean((navigator as Navigator & { standalone?: boolean }).standalone),
        hasBeforeInstallPrompt: false,
        notificationPermission: permission,
        pushManager: 'PushManager' in window && 'serviceWorker' in navigator,
      }),
    )
  }, [permission])

  useEffect(() => {
    function syncPermission() {
      if (typeof Notification === 'undefined') return
      setPermission(Notification.permission)
    }
    document.addEventListener('visibilitychange', syncPermission)
    window.addEventListener('focus', syncPermission)
    return () => {
      document.removeEventListener('visibilitychange', syncPermission)
      window.removeEventListener('focus', syncPermission)
    }
  }, [])

  useEffect(() => {
    if (permission !== 'granted' || !('serviceWorker' in navigator)) return
    let cancelled = false
    void (async () => {
      try {
        const registration = await waitForPushRegistration()
        const existing = await registration.pushManager.getSubscription()
        if (!existing || cancelled) return
        setPushOk(true)
        if (!vapidPublic) return
        try {
          await persistPushSubscription(existing)
        } catch (cause) {
          if (!cancelled) {
            setPushError(clientErrorMessage(cause, 'Could not save this device for push.'))
          }
        }
      } catch {
        // Permission can be granted before a complete subscription exists.
      }
    })()
    return () => {
      cancelled = true
    }
  }, [permission, vapidPublic])

  const prefsQuery = useQuery({
    queryKey: ['notification-preferences', user?.id],
    enabled: Boolean(user?.id),
    queryFn: async () => {
      const { data, error } = await getSupabaseClient()
        .from('notification_preferences')
        .select(
          'weekly_reminder, scores_published, score_corrections, league_updates, draft_deadlines, merge_window',
        )
        .eq('user_id', user!.id)
        .maybeSingle()
      if (error) throw error
      return data
    },
  })

  const togglePref = useMutation({
    mutationFn: async (input: { key: (typeof PREF_FIELDS)[number]['key']; value: boolean }) => {
      const patch: Database['public']['Tables']['notification_preferences']['Update'] = {
        [input.key]: input.value,
      }
      const { error } = await getSupabaseClient()
        .from('notification_preferences')
        .update(patch)
        .eq('user_id', user!.id)
      if (error) throw error
    },
    onSuccess: () => {
      void queryClient.invalidateQueries({ queryKey: ['notification-preferences', user?.id] })
    },
  })

  const markRead = useMutation({
    mutationFn: async (id: string) => {
      const { error } = await getSupabaseClient().rpc('mark_notifications_read', { p_ids: [id] })
      if (error) throw error
    },
    onSuccess: () => {
      void queryClient.invalidateQueries({ queryKey: ['notifications', user?.id] })
    },
  })

  async function enablePush() {
    setPushError(null)
    try {
      if (!vapidPublic) {
        setPushError('Push is not configured on this install yet.')
        return
      }
      if (typeof Notification === 'undefined' || !('serviceWorker' in navigator)) {
        setPushError('This browser does not support Web Push.')
        return
      }
      const nextPermission = await Notification.requestPermission()
      setPermission(nextPermission)
      if (nextPermission !== 'granted') {
        setPushError('Push is off. Kindling still works without it.')
        return
      }
      const registration = await waitForPushRegistration()
      const subscription = await ensurePushSubscription(registration, vapidPublic)
      await persistPushSubscription(subscription)
      setPushOk(true)
    } catch (cause) {
      setPushError(clientErrorMessage(cause, 'Could not enable push.'))
    }
  }

  if (notifications.loading || prefsQuery.isLoading) {
    return (
      <PageContainer>
        <LoadingState label="Loading activity" />
      </PageContainer>
    )
  }

  return (
    <PageContainer>
      <h1 className="font-display text-2xl font-semibold">Activity</h1>
      <section className="space-y-2 rounded-xl bg-card px-4 py-3 ring-1 ring-foreground/10">
        <h2 className="font-medium">Push notifications</h2>
        <p className="text-sm text-muted-foreground">
          Permission is only requested after you tap Notify me. Denying it does not break Kindling.
        </p>
        {gate.kind === 'need_install_ios' ? (
          <p className="text-sm">Install to Home Screen first, then return here to enable push.</p>
        ) : gate.kind === 'denied' ? (
          <p className="text-sm">Push is blocked in this browser. In-app activity still works.</p>
        ) : gate.kind === 'unsupported' ? (
          <p className="text-sm">This browser cannot receive Web Push.</p>
        ) : (
          <Button type="button" className="min-h-11" onClick={() => void enablePush()}>
            {pushOk ? 'Sync this device' : 'Notify me'}
          </Button>
        )}
        {pushOk ? (
          <p className="text-sm">This device is subscribed. You can turn categories off below.</p>
        ) : null}
        {pushError ? (
          <Alert>
            <AlertTitle>Push</AlertTitle>
            <AlertDescription>{pushError}</AlertDescription>
          </Alert>
        ) : null}
      </section>
      <section className="space-y-2">
        <h2 className="font-medium">Preferences</h2>
        <ul className="space-y-2">
          {PREF_FIELDS.map((field) => {
            const on = Boolean(prefsQuery.data?.[field.key])
            return (
              <li key={field.key}>
                <Button
                  type="button"
                  variant={on ? 'default' : 'outline'}
                  className="min-h-11 w-full justify-between"
                  onClick={() => void togglePref.mutateAsync({ key: field.key, value: !on })}
                >
                  {field.label}
                  <span className="text-xs">{on ? 'On' : 'Off'}</span>
                </Button>
              </li>
            )
          })}
        </ul>
      </section>
      {notifications.error ? (
        <ErrorState description="Could not load notifications." onRetry={() => void notifications.refetch()} />
      ) : notifications.items.length === 0 ? (
        <EmptyState
          title="Quiet for now"
          description="League events show up here. Push permission is never requested on first load."
        />
      ) : (
        <ul className="space-y-2">
          {notifications.items.map((item) => (
            <li key={item.id}>
              <Link
                to={item.route.startsWith('/') ? item.route : '/league'}
                className="block min-h-11 rounded-xl bg-card px-4 py-3 ring-1 ring-foreground/10"
                onClick={() => {
                  if (!item.read_at) void markRead.mutateAsync(item.id)
                }}
              >
                <p className="font-medium">{item.title}</p>
                <p className="text-sm text-muted-foreground">{item.body}</p>
              </Link>
            </li>
          ))}
        </ul>
      )}
    </PageContainer>
  )
}
