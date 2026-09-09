import { render, screen } from '@testing-library/react'
import { MemoryRouter } from 'react-router'
import { describe, expect, it } from 'vitest'
import { AuthProvider } from '@/features/auth/AuthProvider'
import { WelcomePage } from '@/pages/WelcomePage'

describe('WelcomePage', () => {
  it('names the product and states it is unofficial', () => {
    render(
      <MemoryRouter>
        <AuthProvider>
          <WelcomePage />
        </AuthProvider>
      </MemoryRouter>,
    )
    expect(screen.getByRole('heading', { name: 'Kindling' })).toBeInTheDocument()
    expect(
      screen.getByText(/unofficial fan-made fantasy game/i),
    ).toBeInTheDocument()
  })
})
