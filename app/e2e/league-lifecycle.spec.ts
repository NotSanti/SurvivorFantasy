import { expect, test } from '@playwright/test'
import {
  completeOnboarding,
  createConfirmedUser,
  hostedAdminAvailable,
  signInViaGeneratedLink,
} from './helpers/auth'

const suffix = Date.now()

test.describe('private leagues', () => {
  test.describe.configure({ timeout: 90_000 })
  test.skip(
    !hostedAdminAvailable(),
    'Hosted e2e auth admin needs E2E_SUPABASE_SERVICE_ROLE in .env.local',
  )
  test('two members can share one league while an outsider cannot', async ({
    browser,
  }) => {
    const commissionerEmail = `commish-${suffix}@example.com`
    const memberEmail = `member-${suffix}@example.com`
    const outsiderEmail = `outsider-${suffix}@example.com`
    await createConfirmedUser(commissionerEmail)
    await createConfirmedUser(memberEmail)
    await createConfirmedUser(outsiderEmail)

    const commissionerContext = await browser.newContext()
    const memberContext = await browser.newContext()
    const outsiderContext = await browser.newContext()
    const commissioner = await commissionerContext.newPage()
    const member = await memberContext.newPage()
    const outsider = await outsiderContext.newPage()

    await signInViaGeneratedLink(commissioner, commissionerEmail)
    await completeOnboarding(commissioner, 'Commissioner')
    await commissioner.getByRole('link', { name: 'Create' }).click()
    await commissioner.getByLabel('League name').fill('Camp Alpha')
    await commissioner.getByRole('button', { name: 'Create private league' }).click()
    await expect(commissioner.getByRole('heading', { name: 'Camp Alpha' })).toBeVisible()
    await commissioner.getByRole('button', { name: 'Create invite link' }).click()
    const inviteText = await commissioner.locator('p.break-all').innerText()
    const inviteUrl = new URL(inviteText)
    const leaguePath = new URL(commissioner.url()).pathname

    await signInViaGeneratedLink(member, memberEmail)
    await completeOnboarding(member, 'Member')
    await member.goto(`${inviteUrl.pathname}${inviteUrl.search}`)
    await expect(member.getByRole('heading', { name: 'Camp Alpha' })).toBeVisible()

    await signInViaGeneratedLink(outsider, outsiderEmail)
    await completeOnboarding(outsider, 'Outsider')
    await outsider.goto(leaguePath)
    await expect(outsider.getByText('This league is not available.')).toBeVisible()

    await outsider.goto('/leagues')
    await outsider.getByRole('link', { name: 'Create' }).click()
    await outsider.getByLabel('League name').fill('Camp Beta')
    await outsider.getByRole('button', { name: 'Create private league' }).click()
    await expect(outsider.getByRole('heading', { name: 'Camp Beta' })).toBeVisible()

    await commissioner.goto('/leagues')
    await expect(commissioner.getByRole('link', { name: /Camp Alpha/ })).toBeVisible()
    await expect(commissioner.getByRole('link', { name: /Camp Beta/ })).toHaveCount(0)

    await commissionerContext.close()
    await memberContext.close()
    await outsiderContext.close()
  })
})
