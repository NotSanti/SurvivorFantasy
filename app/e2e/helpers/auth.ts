import { createClient } from '@supabase/supabase-js'
import type { Page } from '@playwright/test'

const url = process.env.E2E_SUPABASE_URL ?? process.env.VITE_SUPABASE_URL ?? ''
const serviceRole = process.env.E2E_SUPABASE_SERVICE_ROLE ?? process.env.SUPABASE_SERVICE_ROLE_KEY ?? ''

export function hostedAdminAvailable() {
  return Boolean(url && serviceRole && !url.includes('127.0.0.1') && !url.includes('localhost'))
}

export function adminClient() {
  if (!url) {
    throw new Error('Set VITE_SUPABASE_URL or E2E_SUPABASE_URL for hosted e2e')
  }
  if (!serviceRole) {
    throw new Error('Set E2E_SUPABASE_SERVICE_ROLE for hosted auth admin e2e')
  }
  return createClient(url, serviceRole, {
    auth: { persistSession: false, autoRefreshToken: false },
  })
}

export async function createConfirmedUser(email: string, password = 'password123') {
  const admin = adminClient()
  const { data, error } = await admin.auth.admin.createUser({
    email,
    password,
    email_confirm: true,
    user_metadata: { display_name: email.split('@')[0] },
  })
  if (error || !data.user) {
    throw error ?? new Error(`Could not create ${email}`)
  }
  return data.user
}

export async function signInViaGeneratedLink(page: Page, email: string) {
  const admin = adminClient()
  const { data, error } = await admin.auth.admin.generateLink({
    type: 'magiclink',
    email,
  })
  const tokenHash = data.properties?.hashed_token
  if (error || !tokenHash) {
    throw error ?? new Error('Could not generate a magic link')
  }
  await page.goto(`/auth/callback?token_hash=${tokenHash}&type=magiclink`)
  await page.waitForURL((next) => !next.pathname.startsWith('/auth/callback'))
}

export async function completeOnboarding(page: Page, displayName: string) {
  const campName = page.getByRole('heading', { name: 'Choose a camp name' })
  const leagues = page.getByRole('heading', { name: 'Leagues' })
  await Promise.race([campName.waitFor(), leagues.waitFor()])
  if (await leagues.isVisible()) return

  const nameField = page.getByLabel('Display name')
  await nameField.fill(displayName)
  await page.getByRole('button', { name: 'Continue' }).click()
  await leagues.waitFor({ timeout: 15_000 })
}
