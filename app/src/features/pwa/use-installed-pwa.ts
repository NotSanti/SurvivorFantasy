import { useEffect, useState } from 'react'
import { isInstalled } from '@/domain/pwa/install'

function readInstalled() {
  const iosStandalone =
    'standalone' in navigator &&
    Boolean((navigator as Navigator & { standalone?: boolean }).standalone)
  return isInstalled({
    displayModeStandalone: window.matchMedia('(display-mode: standalone)').matches,
    iosStandalone,
  })
}

export function useInstalledPwa() {
  const [installed, setInstalled] = useState(readInstalled)

  useEffect(() => {
    const media = window.matchMedia('(display-mode: standalone)')
    const update = () => setInstalled(readInstalled())
    media.addEventListener('change', update)
    return () => media.removeEventListener('change', update)
  }, [])

  return installed
}
