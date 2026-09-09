import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query'
import { PermissionDeniedState } from '@/components/states/PermissionDeniedState'
import { LoadingState } from '@/components/states/LoadingState'
import { PageContainer } from '@/components/layout/PageContainer'
import { Button } from '@/components/ui/button'
import { useAuth } from '@/features/auth/use-auth'
import { AdminRulesPage } from '@/pages/AdminRulesPage'
import { getSupabaseClient } from '@/lib/supabase'

export function AdminPage() {
  const { user } = useAuth()
  const queryClient = useQueryClient()
  const adminQuery = useQuery({
    queryKey: ['is-admin', user?.id],
    enabled: Boolean(user),
    queryFn: async () => {
      const { data, error } = await getSupabaseClient().rpc('is_admin')
      if (error) throw error
      return Boolean(data)
    },
  })
  const claim = useMutation({
    mutationFn: async () => {
      const { data, error } = await getSupabaseClient().rpc('claim_first_admin')
      if (error) throw error
      return Boolean(data)
    },
    onSuccess: () => {
      void queryClient.invalidateQueries({ queryKey: ['is-admin', user?.id] })
    },
  })

  if (adminQuery.isPending) {
    return (
      <PageContainer className="justify-center">
        <LoadingState label="Checking admin access" />
      </PageContainer>
    )
  }

  if (adminQuery.data) {
    return <AdminRulesPage />
  }

  return (
    <PageContainer>
      <PermissionDeniedState
        title="Admin access required"
        description="Rules sync, aliases, and confirmation are limited to Kindling admins. If this camp has no admin yet, you can claim the first seat."
      />
      <Button type="button" className="min-h-11" onClick={() => void claim.mutateAsync()}>
        {claim.isPending ? 'Claiming…' : 'Claim first admin seat'}
      </Button>
      {claim.isSuccess && !claim.data ? (
        <p className="text-sm text-muted-foreground">An admin already exists.</p>
      ) : null}
    </PageContainer>
  )
}
