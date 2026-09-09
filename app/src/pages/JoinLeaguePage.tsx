import { useEffect, useState } from 'react'
import { Link, useNavigate, useSearchParams } from 'react-router'
import { ErrorState } from '@/components/states/ErrorState'
import { LoadingState } from '@/components/states/LoadingState'
import { PageContainer } from '@/components/layout/PageContainer'
import { Button } from '@/components/ui/button'
import { classifyInviteError, inviteErrorCopy } from '@/domain/invite-errors'
import { useAuth } from '@/features/auth/use-auth'
import { getSupabaseClient } from '@/lib/supabase'
import { writeActiveLeagueId } from '@/features/league/active-league-storage'

export function JoinLeaguePage() {
  const { user, loading } = useAuth()
  const [params] = useSearchParams()
  const token = params.get('token')
  const navigate = useNavigate()
  const [acceptError, setAcceptError] = useState<string | null>(null)

  useEffect(() => {
    if (loading) return
    if (!token) return
    if (!user) {
      navigate(`/?next=${encodeURIComponent(`/join?token=${token}`)}`, { replace: true })
      return
    }

    void getSupabaseClient()
      .rpc('accept_league_invite', { p_token: token })
      .then(({ data, error: rpcError }) => {
        if (rpcError || !data) {
          setAcceptError(rpcError?.message ?? 'This invite could not be accepted.')
          return
        }
        navigate(`/leagues/${data.id}`, { replace: true })
        writeActiveLeagueId(data.id)
      })
  }, [loading, navigate, token, user])

  const reason = classifyInviteError(
    token ? acceptError : 'This invite link is missing a token.',
  )
  const copy = inviteErrorCopy(reason)

  return (
    <PageContainer>
      {token && !acceptError && user ? (
        <LoadingState label="Joining league" />
      ) : token && !user ? (
        <LoadingState label="Redirecting to sign-in" />
      ) : acceptError || !token ? (
        <div className="space-y-4">
          <ErrorState title={copy.title} description={copy.description} />
          <Button asChild className="min-h-11">
            <Link to="/">Back to sign-in</Link>
          </Button>
        </div>
      ) : (
        <LoadingState label="Joining league" />
      )}
    </PageContainer>
  )
}
