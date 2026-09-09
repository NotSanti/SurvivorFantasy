import { useMutation } from '@tanstack/react-query'
import { Alert, AlertDescription, AlertTitle } from '@/components/ui/alert'
import { Button } from '@/components/ui/button'
import { getSupabaseClient } from '@/lib/supabase'

export function AdminPushSection() {
  const flush = useMutation({
    mutationFn: async () => {
      const { data, error } = await getSupabaseClient().functions.invoke('process-outbox', {
        body: {},
      })
      if (error) throw error
      return data as { status?: string; detail?: string; claimed?: number; sent?: number; dead?: number }
    },
  })

  return (
    <section className="space-y-3">
      <h2 className="font-medium">Push outbox</h2>
      <p className="text-sm text-muted-foreground">
        Deliver pending Web Push jobs. Scheduled flushes run every 15 minutes after Edge VAPID and
        CRON_SECRET are set.
      </p>
      <Button type="button" className="min-h-11" onClick={() => void flush.mutateAsync()}>
        {flush.isPending ? 'Flushing…' : 'Flush push outbox'}
      </Button>
      {flush.data ? (
        <Alert>
          <AlertTitle>{flush.data.status ?? 'Outbox'}</AlertTitle>
          <AlertDescription>
            {flush.data.detail ??
              `Claimed ${flush.data.claimed ?? 0}, sent ${flush.data.sent ?? 0}, dead-letter ${flush.data.dead ?? 0}.`}
          </AlertDescription>
        </Alert>
      ) : null}
      {flush.error ? (
        <Alert variant="destructive">
          <AlertTitle>Outbox flush failed</AlertTitle>
          <AlertDescription>
            {flush.error instanceof Error ? flush.error.message : 'Try again after VAPID secrets are set.'}
          </AlertDescription>
        </Alert>
      ) : null}
    </section>
  )
}
