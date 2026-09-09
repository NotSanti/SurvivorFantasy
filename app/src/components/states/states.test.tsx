import { render, screen } from '@testing-library/react'
import { describe, expect, it } from 'vitest'
import { EmptyState } from '@/components/states/EmptyState'
import { ErrorState } from '@/components/states/ErrorState'
import { LoadingState } from '@/components/states/LoadingState'
import { OfflineState } from '@/components/states/OfflineState'
import { PermissionDeniedState } from '@/components/states/PermissionDeniedState'

describe('state primitives', () => {
  it('exposes a loading status for assistive tech', () => {
    render(<LoadingState label="Loading league" />)
    expect(screen.getByRole('status', { name: 'Loading league' })).toBeInTheDocument()
  })

  it('renders empty, error, offline, and permission copy', () => {
    const { rerender } = render(
      <EmptyState title="No league yet" description="Create one to start." />,
    )
    expect(screen.getByRole('heading', { name: 'No league yet' })).toBeInTheDocument()

    rerender(<ErrorState />)
    expect(screen.getByRole('heading', { name: 'Something went wrong' })).toBeInTheDocument()

    rerender(<OfflineState lastSyncedAt="Tuesday 6:12 p.m." />)
    expect(screen.getByText(/last successful read from Tuesday 6:12 p.m/i)).toBeInTheDocument()

    rerender(<PermissionDeniedState />)
    expect(screen.getByRole('heading', { name: 'Permission needed' })).toBeInTheDocument()
  })
})
