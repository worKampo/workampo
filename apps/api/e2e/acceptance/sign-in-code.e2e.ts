import { expect, test } from '@playwright/test'
import {
  EMPTY_STATE,
  enterCode,
  expectSignedOut,
  FAKE_EXPIRED_CODE,
  FAKE_VALID_CODE,
  newEmail,
  RESEND,
  requestCode,
  signInWithCode,
} from './support'

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

  await expect(page.getByText(EMPTY_STATE)).toBeVisible()
  await expect(page).toHaveURL(/\/$/)
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
