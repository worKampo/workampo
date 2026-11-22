import { expect, test } from '@playwright/test'
import {
  enterCode,
  expectSignedOut,
  FAKE_VALID_CODE,
  newEmail,
  RESEND,
  requestCode,
  WAIT,
} from './support'

test.use({ locale: 'es-ES' })

// Thresholds are environment variables (AGENTS.md "No entra"): try until the limit shows up.
const MAX_TRIES = 50

test('@id:access-96-4 after too many attempts the code is not checked', async ({ page }) => {
  await requestCode(page, newEmail())
  for (let i = 0; i < MAX_TRIES; i++) {
    if ((await enterCode(page, '111111')).status() === 429) break
  }
  await expect(page.getByText(WAIT)).toBeVisible()

  const answer = await enterCode(page, FAKE_VALID_CODE)

  expect(answer.status()).toBe(429)
  await expect(page.getByText(WAIT)).toBeVisible()
  await expectSignedOut(page)
})

test('@id:access-96-5 after too many requests no other code is sent', async ({ page }) => {
  await requestCode(page, newEmail())
  const resend = page.getByRole('button', { name: RESEND })

  let status = 0
  for (let i = 0; i < MAX_TRIES && status !== 429; i++) {
    const [answer] = await Promise.all([
      page.waitForResponse((r) => r.url().endsWith('/api/sign-in-codes')),
      resend.click(),
    ])
    status = answer.status()
  }

  expect(status).toBe(429)
  await expect(page.getByText(WAIT)).toBeVisible()
})
