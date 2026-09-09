export type NotificationPermissionState = 'default' | 'granted' | 'denied' | 'unsupported'

export type InstallSnapshot = {
  displayModeStandalone: boolean
  iosStandalone: boolean
  ios: boolean
  hasBeforeInstallPrompt: boolean
  notificationPermission: NotificationPermissionState
  pushManager: boolean
}

export type InstallEducation =
  | { kind: 'hidden' }
  | { kind: 'installed' }
  | { kind: 'chromium_prompt' }
  | { kind: 'ios_homescreen' }

export type PushGate =
  | { kind: 'ready' }
  | { kind: 'need_gesture' }
  | { kind: 'denied' }
  | { kind: 'need_install_ios' }
  | { kind: 'unsupported' }

export function isInstalled(snapshot: Pick<InstallSnapshot, 'displayModeStandalone' | 'iosStandalone'>) {
  return snapshot.displayModeStandalone || snapshot.iosStandalone
}

export function installEducation(snapshot: InstallSnapshot): InstallEducation {
  if (isInstalled(snapshot)) return { kind: 'installed' }
  if (snapshot.ios) return { kind: 'ios_homescreen' }
  if (snapshot.hasBeforeInstallPrompt) return { kind: 'chromium_prompt' }
  return { kind: 'hidden' }
}

export function pushGate(snapshot: InstallSnapshot): PushGate {
  if (!snapshot.pushManager || snapshot.notificationPermission === 'unsupported') {
    return { kind: 'unsupported' }
  }
  if (snapshot.ios && !isInstalled(snapshot)) return { kind: 'need_install_ios' }
  if (snapshot.notificationPermission === 'denied') return { kind: 'denied' }
  if (snapshot.notificationPermission === 'granted') return { kind: 'ready' }
  return { kind: 'need_gesture' }
}

export function readInstallSnapshot(input: {
  userAgent: string
  standaloneMedia: boolean
  iosStandalone: boolean
  hasBeforeInstallPrompt: boolean
  notificationPermission?: NotificationPermissionState
  pushManager: boolean
}): InstallSnapshot {
  const ios = /iphone|ipad|ipod/i.test(input.userAgent) ||
    (/macintosh/i.test(input.userAgent) && input.iosStandalone)
  return {
    displayModeStandalone: input.standaloneMedia,
    iosStandalone: input.iosStandalone,
    ios,
    hasBeforeInstallPrompt: input.hasBeforeInstallPrompt,
    notificationPermission: input.notificationPermission ?? 'unsupported',
    pushManager: input.pushManager,
  }
}
