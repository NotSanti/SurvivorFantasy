import AxeBuilder from '@axe-core/playwright'
import { expect, test } from '@playwright/test'

test('welcome screen is usable on a mobile viewport', async ({ page }) => {
  await page.goto('/')
  await expect(page.getByRole('heading', { name: 'Kindling' })).toBeVisible()
  await expect(page.getByText(/unofficial fan-made fantasy game/i)).toBeVisible()
  const email = page.getByLabel('Email')
  const localConfig = page.getByText(/local configuration needed/i)
  await expect(email.or(localConfig)).toBeVisible()
})

test('welcome has no critical or serious accessibility violations', async ({ page }) => {
  await page.goto('/')
  await expect(page.getByRole('heading', { name: 'Kindling' })).toBeVisible()
  const results = await new AxeBuilder({ page }).analyze()
  const blocking = results.violations.filter(
    (violation) => violation.impact === 'critical' || violation.impact === 'serious',
  )
  expect(blocking, JSON.stringify(blocking, null, 2)).toEqual([])
})

test('protected routes send signed-out visitors to welcome', async ({ page }) => {
  await page.goto('/admin')
  await expect(page.getByRole('heading', { name: 'Kindling' })).toBeVisible()
  await page.goto('/leagues/00000000-0000-0000-0000-000000000000/draft')
  await expect(page.getByRole('heading', { name: 'Kindling' })).toBeVisible()
})
