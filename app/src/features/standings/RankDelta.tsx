import { Badge } from '@/components/ui/badge'

type RankDeltaProps = {
  delta: number | null
}

export function RankDelta({ delta }: RankDeltaProps) {
  if (delta == null || delta === 0) {
    return <span className="text-xs text-muted-foreground">—</span>
  }
  const up = delta > 0
  return (
    <Badge variant={up ? 'default' : 'secondary'} aria-label={up ? `Up ${delta}` : `Down ${Math.abs(delta)}`}>
      {up ? `↑${delta}` : `↓${Math.abs(delta)}`}
    </Badge>
  )
}
