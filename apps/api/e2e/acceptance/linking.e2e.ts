import { expect, test } from '@playwright/test'
import { currentUser, expectSignedOut, signInWithCode, signInWithGoogle } from './support'

test.use({ locale: 'es-ES' })

// The seed links these users to the fake provider's identities (@id:access-96-8 to access-96-12).
const SUPPORT = /soporte/i

test('@id:access-96-8 a linked identity signs in to the same account', async ({ page }) => {
  await signInWithCode(page, 'linked@example.com')
  const first = await currentUser(page)
  await page.context().clearCookies()
  await signInWithCode(page, 'linked@example.com')
  expect((await currentUser(page)).id).toBe(first.id)

  await page.context().clearCookies()
  await signInWithGoogle(page)
  await expect(page).toHaveURL(/\/$/)
  const google = await currentUser(page)
  await page.context().clearCookies()
  await signInWithGoogle(page)
  await expect(page).toHaveURL(/\/$/)
  expect((await currentUser(page)).id).toBe(google.id)
})

test('@id:access-96-9 an identity without a verified email does not sign in', async ({ page }) => {
  await signInWithCode(page, 'unverified@example.com')

  await expect(page.getByText(/verificado/i)).toBeVisible()
  await expectSignedOut(page)
})

test('@id:access-96-10 a new identity with the email of another account neither signs in nor links', async ({
  page,
}) => {
  await signInWithCode(page, 'taken@example.com')

  await expect(page.getByText(SUPPORT)).toBeVisible()
  await expectSignedOut(page)
})

test('@id:access-96-11 a new verified email is saved in the account on sign-in', async ({
  page,
}) => {
  await signInWithCode(page, 'renamed@example.com')

  expect((await currentUser(page)).email).toBe('renamed.new@example.com')
})

test('@id:access-96-12 a new verified email that belongs to another account changes nothing', async ({
  page,
}) => {
  await signInWithCode(page, 'clash@example.com')

  await expect(page.getByText(SUPPORT)).toBeVisible()
  await expectSignedOut(page)
  await signInWithCode(page, 'linked@example.com')
  expect((await currentUser(page)).email).toBe('linked@example.com')
})
