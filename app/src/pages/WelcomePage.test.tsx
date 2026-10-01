import { render, screen } from '@testing-library/react'
import userEvent from '@testing-library/user-event'
import { MemoryRouter } from 'react-router'
import { describe, expect, it, vi } from 'vitest'
import { AuthContext, type AuthState } from '@/features/auth/auth-context'
import { WelcomePage } from '@/pages/WelcomePage'

function renderWelcome(auth: Partial<AuthState> = {}) {
  const value: AuthState = {
    loading: false,
    configured: true,
    session: null,
    user: null,
    error: null,
    signInWithEmail: vi.fn().mockResolvedValue(undefined),
    verifyEmailOtp: vi.fn().mockResolvedValue(undefined),
    signOut: vi.fn().mockResolvedValue(undefined),
    ...auth,
  }
  return {
    ...render(
      <MemoryRouter>
        <AuthContext.Provider value={value}>
          <WelcomePage />
        </AuthContext.Provider>
      </MemoryRouter>,
    ),
    auth: value,
  }
}

describe('WelcomePage', () => {
  it('names the product', () => {
    renderWelcome()
    expect(screen.getByRole('heading', { name: 'SFL' })).toBeInTheDocument()
  })

  it('moves to the OTP step after sending a code', async () => {
    const user = userEvent.setup()
    const { auth } = renderWelcome()
    await user.type(screen.getByLabelText('Email'), 'camp@example.com')
    await user.click(screen.getByRole('button', { name: 'Email me a code' }))
    expect(auth.signInWithEmail).toHaveBeenCalledWith('camp@example.com')
    expect(await screen.findByLabelText('Sign-in code')).toBeInTheDocument()
    await user.type(screen.getByLabelText('Sign-in code'), '123456')
    await user.click(screen.getByRole('button', { name: 'Verify and sign in' }))
    expect(auth.verifyEmailOtp).toHaveBeenCalledWith('camp@example.com', '123456')
  })
})
