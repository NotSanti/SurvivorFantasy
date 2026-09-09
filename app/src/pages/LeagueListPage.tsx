import { useQuery } from '@tanstack/react-query'
import { Link } from 'react-router'
import { EmptyState } from '@/components/states/EmptyState'
import { ErrorState } from '@/components/states/ErrorState'
import { LoadingState } from '@/components/states/LoadingState'
import { PageContainer } from '@/components/layout/PageContainer'
import { Button } from '@/components/ui/button'
import { getSupabaseClient } from '@/lib/supabase'
import { useAuth } from '@/features/auth/use-auth'
import { writeActiveLeagueId } from '@/features/league/active-league-storage'

export function LeagueListPage() {
  const { user } = useAuth()
  const query = useQuery({
    queryKey: ['leagues', user?.id],
    enabled: Boolean(user),
    queryFn: async () => {
      const { data, error } = await getSupabaseClient()
        .from('leagues')
        .select('id, name, status')
        .neq('status', 'archived')
      if (error) throw error
      return data
    },
  })

  return (
    <PageContainer>
      <div className="flex items-center justify-between gap-3">
        <h1 className="font-display text-2xl font-semibold">Leagues</h1>
        <Button asChild className="min-h-11">
          <Link to="/leagues/new">Create</Link>
        </Button>
      </div>
      {query.isLoading ? <LoadingState label="Loading leagues" /> : null}
      {query.error ? (
        <ErrorState
          description={query.error instanceof Error ? query.error.message : 'Could not load leagues.'}
          onRetry={() => void query.refetch()}
        />
      ) : null}
      {query.data?.length === 0 ? (
        <EmptyState
          title="No league yet"
          description="Create a private league or accept an invite."
        />
      ) : null}
      <ul className="space-y-2">
        {query.data?.map((league) => (
          <li key={league.id}>
            <Link
              to={`/leagues/${league.id}`}
              className="flex min-h-11 items-center justify-between rounded-xl bg-card px-4 py-3 ring-1 ring-foreground/10"
              onClick={() => writeActiveLeagueId(league.id)}
            >
              <span>{league.name}</span>
              <span className="text-xs text-muted-foreground">{league.status}</span>
            </Link>
          </li>
        ))}
      </ul>
    </PageContainer>
  )
}
