import { render, screen } from '@testing-library/react'
import { MemoryRouter } from 'react-router'
import { describe, expect, it } from 'vitest'
import { AuthProvider } from '@/features/auth/AuthProvider'
import { JoinLeaguePage } from '@/pages/JoinLeaguePage'

describe('JoinLeaguePage', () => {
  it('explains a missing invite token', () => {
    render(
      <MemoryRouter initialEntries={['/join']}>
        <AuthProvider>
          <JoinLeaguePage />
        </AuthProvider>
      </MemoryRouter>,
    )
    expect(screen.getByText('Invite not available')).toBeInTheDocument()
    expect(screen.getByText(/missing a token/i)).toBeInTheDocument()
  })

  it('does not render a raw invite token from the URL', () => {
    const token = 'aabbccddeeff00112233445566778899aabbccddeeff0011'
    render(
      <MemoryRouter initialEntries={[`/join?token=${token}`]}>
        <AuthProvider>
          <JoinLeaguePage />
        </AuthProvider>
      </MemoryRouter>,
    )
    expect(document.body.textContent ?? '').not.toContain(token)
  })
})
