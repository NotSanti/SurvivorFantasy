import { expect, test } from '@playwright/test'

test('welcome screen is usable on a mobile viewport', async ({ page }) => {
  await page.goto('/')
  await expect(page.getByRole('heading', { name: 'Kindling' })).toBeVisible()
  await expect(page.getByText(/unofficial fan-made fantasy game/i)).toBeVisible()
  await expect(page.getByLabel('Email')).toBeVisible()
  await expect(page.getByRole('button', { name: /email me a sign-in link/i })).toBeVisible()
})

test('protected routes send signed-out visitors to welcome', async ({ page }) => {
  await page.goto('/admin')
  await expect(page.getByRole('heading', { name: 'Kindling' })).toBeVisible()
  await page.goto('/leagues/00000000-0000-0000-0000-000000000000/draft')
  await expect(page.getByRole('heading', { name: 'Kindling' })).toBeVisible()
})
