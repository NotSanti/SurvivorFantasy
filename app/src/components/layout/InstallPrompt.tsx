import { useEffect, useMemo, useState } from 'react'
import { Button } from '@/components/ui/button'
import { installEducation, readInstallSnapshot, type InstallSnapshot } from '@/domain/pwa/install'

type BeforeInstallPromptEvent = Event & {
  prompt: () => Promise<void>
}

function snapshotFromWindow(hasPrompt: boolean): InstallSnapshot {
  const permission =
    typeof Notification === 'undefined' ? 'unsupported' : Notification.permission
  return readInstallSnapshot({
    userAgent: navigator.userAgent,
    standaloneMedia: window.matchMedia('(display-mode: standalone)').matches,
    iosStandalone: 'standalone' in navigator && Boolean((navigator as Navigator & { standalone?: boolean }).standalone),
    hasBeforeInstallPrompt: hasPrompt,
    notificationPermission: permission,
    pushManager: 'PushManager' in window && 'serviceWorker' in navigator,
  })
}

export function InstallPrompt() {
  const [promptEvent, setPromptEvent] = useState<BeforeInstallPromptEvent | null>(null)
  const snapshot = useMemo(
    () => snapshotFromWindow(Boolean(promptEvent)),
    [promptEvent],
  )

  useEffect(() => {
    const onPrompt = (event: Event) => {
      event.preventDefault()
      setPromptEvent(event as BeforeInstallPromptEvent)
    }
    window.addEventListener('beforeinstallprompt', onPrompt)
    return () => window.removeEventListener('beforeinstallprompt', onPrompt)
  }, [])

  const education = installEducation(snapshot)

  if (education.kind === 'hidden' || education.kind === 'installed') return null

  return (
    <section className="mx-auto w-full max-w-lg px-4 pt-3">
      <div className="space-y-2 rounded-xl bg-card px-4 py-3 ring-1 ring-foreground/10">
        <h2 className="font-medium">Install Kindling</h2>
        {education.kind === 'ios_homescreen' ? (
          <p className="text-sm text-muted-foreground">
            On iPhone and iPad, open the Share sheet and choose Add to Home Screen. Push
            notifications need that installed icon on iOS 16.4+.
          </p>
        ) : (
          <>
            <p className="text-sm text-muted-foreground">
              Add Kindling to your home screen for a full-screen camp and faster return visits.
            </p>
            <Button
              type="button"
              className="min-h-11"
              onClick={() => void promptEvent?.prompt()}
              disabled={!promptEvent}
            >
              Add to home screen
            </Button>
          </>
        )}
      </div>
    </section>
  )
}
