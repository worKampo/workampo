import { expect, type Page, test } from '@playwright/test'
import { currentUser, newEmail, requestCode, signInWithCode } from './support'

test.use({ locale: 'es-ES' })

async function expectNoPassword(page: Page) {
  await expect(page.locator('input[type="password"]')).toHaveCount(0)
  await expect(page.getByText(/contraseña|crea una cuenta/i)).toHaveCount(0)
}

test('@id:access-96-16 /login and the code screen load nothing from another origin and ask for no password', async ({
  page,
}) => {
  const requested: string[] = []
  page.on('request', (r) => requested.push(r.url()))

  await page.goto('/login')
  await expectNoPassword(page)
  await requestCode(page, newEmail())
  await expectNoPassword(page)

  const origin = new URL(page.url()).origin
  const foreign = requested.filter(
    (url) => url.startsWith('http') && new URL(url).origin !== origin,
  )
  expect(foreign).toEqual([])
})

test('@id:access-96-17 with the browser in Spanish /login is in Spanish', async ({ page }) => {
  await page.goto('/login')

  await expect(page.locator('html')).toHaveAttribute('lang', 'es')
  await expect(page.getByRole('button', { name: 'Continuar', exact: true })).toBeVisible()
})

test('@id:access-96-18 the staging smoke signs in with a code created by the WorkOS API', {
  tag: '@smoke',
}, async ({ page }) => {
  await signInWithCode(page, 'smoke@example.com')

  await currentUser(page)
  await expectNoPassword(page)
})
