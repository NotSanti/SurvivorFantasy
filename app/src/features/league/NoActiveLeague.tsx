import { Link } from 'react-router'
import { EmptyState } from '@/components/states/EmptyState'
import { Button } from '@/components/ui/button'

export function NoActiveLeague() {
  return (
    <EmptyState
      title="No league yet"
      description="Create a private league or accept an invite. Bottom navigation follows the league you last opened."
      action={
        <Button asChild className="min-h-11">
          <Link to="/leagues">View leagues</Link>
        </Button>
      }
    />
  )
}
