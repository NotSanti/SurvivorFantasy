import { Link } from 'react-router'
import { ErrorState } from '@/components/states/ErrorState'
import { Button } from '@/components/ui/button'

export function NotFoundPage() {
  return (
    <main className="mx-auto flex min-h-svh max-w-lg items-center px-4">
      <div className="w-full space-y-4">
        <ErrorState
          title="This campfire is out"
          description="That page is not in Kindling. Head back to league home."
        />
        <Button asChild className="min-h-11">
          <Link to="/league">Go to league</Link>
        </Button>
      </div>
    </main>
  )
}
