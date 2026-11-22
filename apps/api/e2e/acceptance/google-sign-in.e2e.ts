import { expect, test } from '@playwright/test'
import { EMPTY_STATE, expectSignedOut, SESSION_COOKIE, signInWithGoogle } from './support'

test.use({ locale: 'es-ES' })

test('@id:access-96-6 Google confirms and I come back signed in', async ({ page }) => {
  await signInWithGoogle(page)

  await expect(page.getByText(EMPTY_STATE)).toBeVisible()
  await expect(page).toHaveURL(/\/$/)
})

test('@id:access-96-7 a state my browser did not generate creates no session', async ({ page }) => {
  await page.route('**/api/sessions/google/callback**', (route) => {
    const url = new URL(route.request().url())
    url.searchParams.set('state', 'forged')
    return route.continue({ url: url.href })
  })

  await signInWithGoogle(page)

  await expect(page).toHaveURL(/\/login/)
  const cookies = await page.context().cookies()
  expect(cookies.some((c) => c.name === SESSION_COOKIE)).toBe(false)
  await expectSignedOut(page)
})
