import { createContext } from 'react'
import type { Session, User } from '@supabase/supabase-js'

export type AuthState = {
  loading: boolean
  configured: boolean
  session: Session | null
  user: User | null
  error: string | null
  signInWithEmail: (email: string) => Promise<void>
  verifyEmailOtp: (email: string, token: string) => Promise<void>
  signOut: () => Promise<void>
}

export const AuthContext = createContext<AuthState | null>(null)
