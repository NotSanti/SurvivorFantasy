import { QueryClientProvider } from '@tanstack/react-query'
import { MemoryRouter, Route, Routes } from 'react-router'
import { render, screen } from '@testing-library/react'
import userEvent from '@testing-library/user-event'
import { describe, expect, it } from 'vitest'
import { AppShell } from '@/app/AppShell'
import { AuthProvider } from '@/features/auth/AuthProvider'
import { createQueryClient } from '@/lib/query-client'

function renderShell(path = '/league') {
  return render(
    <QueryClientProvider client={createQueryClient()}>
      <AuthProvider>
        <MemoryRouter initialEntries={[path]}>
          <Routes>
            <Route element={<AppShell />}>
              <Route path="/league" element={<div>League body</div>} />
              <Route path="/tribe" element={<div>Tribe body</div>} />
              <Route path="/standings" element={<div>Standings body</div>} />
              <Route path="/activity" element={<div>Activity body</div>} />
            </Route>
          </Routes>
        </MemoryRouter>
      </AuthProvider>
    </QueryClientProvider>,
  )
}

describe('AppShell', () => {
  it('renders primary navigation and the unofficial disclaimer', () => {
    renderShell()
    expect(screen.getByRole('navigation', { name: 'Primary' })).toBeInTheDocument()
    expect(screen.getByRole('link', { name: 'League' })).toBeInTheDocument()
    expect(screen.getByRole('link', { name: 'Tribe' })).toBeInTheDocument()
    expect(screen.getByRole('link', { name: 'Standings' })).toBeInTheDocument()
    expect(screen.getByRole('link', { name: 'Activity' })).toBeInTheDocument()
    expect(
      screen.getByText(/not affiliated with or endorsed by survivor, cbs, corus, or global/i),
    ).toBeInTheDocument()
    expect(screen.getByText('League body')).toBeInTheDocument()
  })

  it('moves keyboard focus through bottom navigation', async () => {
    const user = userEvent.setup()
    renderShell()
    await user.tab()
    expect(screen.getByRole('link', { name: 'Kindling' })).toHaveFocus()
    await user.tab()
    expect(screen.getByRole('link', { name: 'Admin' })).toHaveFocus()
    await user.tab()
    expect(screen.getByRole('link', { name: 'League' })).toHaveFocus()
  })
})
