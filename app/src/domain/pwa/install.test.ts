import { describe, expect, it } from 'vitest'
import { installEducation, pushGate, readInstallSnapshot } from './install'

describe('installEducation', () => {
  it('hides Chromium install UI until a user gesture can complete it', () => {
    const snapshot = readInstallSnapshot({
      userAgent: 'Mozilla/5.0 Chrome/120',
      standaloneMedia: false,
      iosStandalone: false,
      hasBeforeInstallPrompt: true,
      notificationPermission: 'default',
      pushManager: true,
    })
    expect(installEducation(snapshot)).toEqual({ kind: 'chromium_prompt' })
  })

  it('explains Home Screen install on iPhone instead of guessing a prompt', () => {
    const snapshot = readInstallSnapshot({
      userAgent: 'Mozilla/5.0 (iPhone; CPU iPhone OS 17_0 like Mac OS X)',
      standaloneMedia: false,
      iosStandalone: false,
      hasBeforeInstallPrompt: false,
      notificationPermission: 'default',
      pushManager: true,
    })
    expect(installEducation(snapshot)).toEqual({ kind: 'ios_homescreen' })
    expect(pushGate(snapshot)).toEqual({ kind: 'need_install_ios' })
  })

  it('treats an installed app as ready for a later notify-me tap', () => {
    const snapshot = readInstallSnapshot({
      userAgent: 'Mozilla/5.0 (iPhone; CPU iPhone OS 17_0 like Mac OS X)',
      standaloneMedia: true,
      iosStandalone: true,
      hasBeforeInstallPrompt: false,
      notificationPermission: 'default',
      pushManager: true,
    })
    expect(installEducation(snapshot)).toEqual({ kind: 'installed' })
    expect(pushGate(snapshot)).toEqual({ kind: 'need_gesture' })
  })
})

describe('pushGate', () => {
  it('keeps the app usable after a denied permission', () => {
    expect(
      pushGate({
        displayModeStandalone: true,
        iosStandalone: false,
        ios: false,
        hasBeforeInstallPrompt: false,
        notificationPermission: 'denied',
        pushManager: true,
      }),
    ).toEqual({ kind: 'denied' })
  })
})
