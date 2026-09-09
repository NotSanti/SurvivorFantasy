import { Button } from '@/components/ui/button'
import { useSpoilerMode } from '@/hooks/use-spoiler-mode'

export function SpoilerToggle() {
  const { hidden, setMode } = useSpoilerMode()
  return (
    <Button
      type="button"
      variant="outline"
      className="min-h-11"
      aria-pressed={hidden}
      onClick={() => setMode(hidden ? 'show' : 'hide_latest_episode')}
    >
      {hidden ? 'Show this week’s scores' : 'Hide this week’s scores'}
    </Button>
  )
}
