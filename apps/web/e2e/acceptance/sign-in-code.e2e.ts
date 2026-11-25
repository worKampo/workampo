import { expect, test } from '@playwright/test'
import {
  currentUser,
  enterCode,
  expectSignedOut,
  FAKE_EXPIRED_CODE,
  FAKE_VALID_CODE,
  newEmail,
  RESEND,
  requestCode,
  signInWithCode,
} from '../../../../e2e/support/acceptance-support'

test.use({ locale: 'es-ES' })

test('@id:access-96-1 requesting a code leads to the code screen and the answer does not contain it', async ({
  page,
}) => {
  const answer = await requestCode(page, newEmail())

  expect(await answer.text()).not.toContain(FAKE_VALID_CODE)
})

test('@id:access-96-2 the right code of an email without an account creates it and signs in', async ({
  page,
}) => {
  const email = newEmail()

  await signInWithCode(page, email)

  // With no company yet the sign-in lands on the creation form.
  await expect(page).toHaveURL(/\/companies\/new$/)
  await expect(page.getByLabel('Nombre de la empresa')).toBeVisible()
  expect((await currentUser(page)).email).toBe(email)
})

test('@id:access-96-3 a wrong or expired code does not sign in', async ({ page }) => {
  await requestCode(page, newEmail())

  for (const code of ['111111', FAKE_EXPIRED_CODE]) {
    await enterCode(page, code)
    await expect(page.getByText(/no es válido/i)).toBeVisible()
    await expect(page.getByRole('button', { name: RESEND })).toBeVisible()
  }
  await expectSignedOut(page)
})
