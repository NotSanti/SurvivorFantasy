import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query'
import { useEffect } from 'react'
import { Link, useNavigate, useParams } from 'react-router'
import { EmptyState } from '@/components/states/EmptyState'
import { ErrorState } from '@/components/states/ErrorState'
import { LoadingState } from '@/components/states/LoadingState'
import { PageContainer } from '@/components/layout/PageContainer'
import { Button } from '@/components/ui/button'
import { Badge } from '@/components/ui/badge'
import { useAuth } from '@/features/auth/use-auth'
import { writeActiveLeagueId } from '@/features/league/active-league-storage'
import { getSupabaseClient } from '@/lib/supabase'

export function LeagueLobbyPage() {
  const { leagueId } = useParams()
  const { user } = useAuth()
  const navigate = useNavigate()
  const queryClient = useQueryClient()

  useEffect(() => {
    if (leagueId) writeActiveLeagueId(leagueId)
  }, [leagueId])
  const leagueQuery = useQuery({
    queryKey: ['league', leagueId],
    enabled: Boolean(leagueId),
    queryFn: async () => {
      const { data, error } = await getSupabaseClient()
        .from('leagues')
        .select('id, name, status, max_members, commissioner_id')
        .eq('id', leagueId!)
        .single()
      if (error) throw error
      return data
    },
  })
  const membersQuery = useQuery({
    queryKey: ['league-members', leagueId],
    enabled: Boolean(leagueId),
    queryFn: async () => {
      const supabase = getSupabaseClient()
      const { data: members, error } = await supabase
        .from('league_members')
        .select('user_id, role, status, ready_at')
        .eq('league_id', leagueId!)
        .eq('status', 'active')
      if (error) throw error
      const ids = members.map((member) => member.user_id)
      const { data: profiles, error: profileError } = await supabase
        .from('profiles')
        .select('id, display_name')
        .in('id', ids)
      if (profileError) throw profileError
      return members.map((member) => ({
        ...member,
        displayName:
          profiles.find((profile) => profile.id === member.user_id)?.display_name ??
          'League member',
      }))
    },
  })
  const invitesQuery = useQuery({
    queryKey: ['league-invites', leagueId],
    enabled: Boolean(leagueId && leagueQuery.data?.commissioner_id === user?.id),
    queryFn: async () => {
      const { data, error } = await getSupabaseClient()
        .from('league_invites')
        .select('id, expires_at, revoked_at, use_count, max_uses')
        .eq('league_id', leagueId!)
        .order('created_at', { ascending: false })
      if (error) throw error
      return data
    },
  })

  const invite = useMutation({
    mutationFn: async () => {
      const { data, error } = await getSupabaseClient().rpc('create_league_invite', {
        p_league_id: leagueId!,
      })
      if (error) throw error
      return data
    },
    onSuccess: () => {
      void queryClient.invalidateQueries({ queryKey: ['league-invites', leagueId] })
    },
  })
  const revoke = useMutation({
    mutationFn: async (inviteId: string) => {
      const { error } = await getSupabaseClient().rpc('revoke_league_invite', {
        p_invite_id: inviteId,
      })
      if (error) throw error
    },
    onSuccess: () => {
      void queryClient.invalidateQueries({ queryKey: ['league-invites', leagueId] })
    },
  })
  const ready = useMutation({
    mutationFn: async (isReady: boolean) => {
      const { error } = await getSupabaseClient().rpc('set_league_ready', {
        p_league_id: leagueId!,
        p_ready: isReady,
      })
      if (error) throw error
    },
    onSuccess: () => {
      void queryClient.invalidateQueries({ queryKey: ['league-members', leagueId] })
    },
  })
  const leave = useMutation({
    mutationFn: async () => {
      const { error } = await getSupabaseClient().rpc('leave_league', {
        p_league_id: leagueId!,
      })
      if (error) throw error
    },
    onSuccess: () => navigate('/leagues'),
  })
  const archive = useMutation({
    mutationFn: async () => {
      const { error } = await getSupabaseClient().rpc('archive_league', {
        p_league_id: leagueId!,
      })
      if (error) throw error
    },
    onSuccess: () => navigate('/leagues'),
  })
  const startSelection = useMutation({
    mutationFn: async () => {
      const { error } = await getSupabaseClient().rpc('start_league_selection', {
        p_league_id: leagueId!,
      })
      if (error) throw error
    },
    onSuccess: () => {
      void queryClient.invalidateQueries({ queryKey: ['league', leagueId] })
      navigate(`/leagues/${leagueId}/draft`)
    },
  })

  const actionError =
    invite.error ?? leave.error ?? archive.error ?? startSelection.error
  const actionErrorMessage =
    actionError instanceof Error ? actionError.message : 'That action failed.'
  const isCommissioner = leagueQuery.data?.commissioner_id === user?.id
  const self = membersQuery.data?.find((member) => member.user_id === user?.id)
  const recruiting = leagueQuery.data?.status === 'recruiting'
  const selecting = leagueQuery.data?.status === 'selecting'

  return (
    <PageContainer>
      <div className="space-y-1">
        <h1 className="font-display text-2xl font-semibold">
          {leagueQuery.data?.name ?? 'League'}
        </h1>
        <p className="text-sm text-muted-foreground">
          {membersQuery.data?.length ?? 0}/{leagueQuery.data?.max_members ?? '—'} members ·{' '}
          {leagueQuery.data?.status?.replaceAll('_', ' ')}
        </p>
      </div>
      {leagueQuery.isLoading || membersQuery.isLoading ? (
        <LoadingState label="Loading lobby" />
      ) : null}
      {leagueQuery.error ? (
        <ErrorState description="This league is not available." />
      ) : null}
      {membersQuery.data ? (
        <ul className="space-y-2">
          {membersQuery.data.map((member) => (
            <li
              key={member.user_id}
              className="flex min-h-11 items-center justify-between rounded-xl bg-card px-4 py-2 ring-1 ring-foreground/10"
            >
              <span className="text-sm">{member.displayName}</span>
              <div className="flex items-center gap-2">
                <Badge variant="secondary">{member.role}</Badge>
                {member.ready_at ? <Badge>Ready</Badge> : null}
              </div>
            </li>
          ))}
        </ul>
      ) : (
        <EmptyState title="No members" description="Invites will appear here after you share a link." />
      )}
      {recruiting ? (
        <Button
          type="button"
          className="min-h-11"
          onClick={() => void ready.mutateAsync(!self?.ready_at)}
        >
          {self?.ready_at ? 'Mark unready' : 'Mark ready'}
        </Button>
      ) : null}
      {isCommissioner && recruiting ? (
        <Button type="button" className="min-h-11" onClick={() => void invite.mutateAsync()}>
          Create invite link
        </Button>
      ) : null}
      {invite.data ? (
        <p className="break-all rounded-lg bg-muted p-3 text-sm">
          {`${window.location.origin}/join?token=${invite.data}`}
        </p>
      ) : null}
      {invitesQuery.data && invitesQuery.data.length > 0 ? (
        <ul className="space-y-2 text-sm">
          {invitesQuery.data.map((row) => (
            <li key={row.id} className="flex items-center justify-between gap-2">
              <span>
                {row.revoked_at
                  ? 'Revoked'
                  : new Date(row.expires_at) < new Date()
                    ? 'Expired'
                    : `Open · ${row.use_count}${row.max_uses ? `/${row.max_uses}` : ''} uses`}
              </span>
              {!row.revoked_at && new Date(row.expires_at) > new Date() ? (
                <Button
                  type="button"
                  variant="outline"
                  className="min-h-11"
                  onClick={() => void revoke.mutateAsync(row.id)}
                >
                  Revoke
                </Button>
              ) : null}
            </li>
          ))}
        </ul>
      ) : null}
      {isCommissioner && recruiting ? (
        <Button
          type="button"
          variant="secondary"
          className="min-h-11"
          onClick={() => void startSelection.mutateAsync()}
        >
          Start draft room
        </Button>
      ) : null}
      {selecting ? (
        <Button className="min-h-11" asChild>
          <Link to={`/leagues/${leagueId}/draft`}>Open draft room</Link>
        </Button>
      ) : null}
      {!recruiting && !selecting ? (
        <Button className="min-h-11" asChild>
          <Link to="/league">League home</Link>
        </Button>
      ) : null}
      {recruiting ? (
        <Button
          type="button"
          variant="outline"
          className="min-h-11"
          onClick={() => void leave.mutateAsync()}
        >
          Leave league
        </Button>
      ) : null}
      {isCommissioner && recruiting ? (
        <Button
          type="button"
          variant="destructive"
          className="min-h-11"
          onClick={() => void archive.mutateAsync()}
        >
          Archive league
        </Button>
      ) : null}
      {invite.error || leave.error || archive.error || startSelection.error ? (
        <ErrorState description={actionErrorMessage} />
      ) : null}
      <p className="text-sm text-muted-foreground">
        Picks stay hidden until the commissioner locks the league. Late joining is disabled after
        selection begins.
      </p>
    </PageContainer>
  )
}
