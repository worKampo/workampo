import { expect, type Page, test } from '@playwright/test'
import {
  newEmail,
  signInWithCodeAt,
  signInWithGoogle,
} from '../../../../e2e/support/acceptance-support'

test.use({ locale: 'es-ES' })

// Seed: linked@example.com is a member of northwind; the fake's Google account has no company.
const NORTHWIND_MEMBER = 'linked@example.com'
const SETTINGS = '/c/northwind/settings'
const FOREIGN = 'https://otro-sitio.example.com'

// Opening an app page without a session leads to /login, carrying that page along.
async function openSignedOut(page: Page, path: string) {
  await page.goto(path)
  await expect(page).toHaveURL(/\/login\?/)
  const url = new URL(page.url())
  expect(url.pathname).toBe('/login')
  expect(url.searchParams.get('returnTo')).toBe(path)

  return page.url()
}

const pathOf = (page: Page) => {
  const url = new URL(page.url())
  return `${url.pathname}${url.search}`
}

const foreignLogin = `/login?returnTo=${encodeURIComponent(FOREIGN)}`

test('@id:access-91-1 signing in with a code comes back to the page I opened', async ({ page }) => {
  const login = await openSignedOut(page, SETTINGS)

  await signInWithCodeAt(page, { email: NORTHWIND_MEMBER, path: login })

  await expect(page).toHaveURL(new RegExp(`${SETTINGS}$`))
  expect(pathOf(page)).toBe(SETTINGS)
})

test('@id:access-91-1 the way back survives choosing another email on the code screen', async ({
  page,
}) => {
  await openSignedOut(page, SETTINGS)
  const email = newEmail()
  await page.getByRole('textbox').fill(email)
  await page.getByRole('button', { name: 'Continuar', exact: true }).click()
  await expect(page.getByText(email)).toBeVisible()

  await page.getByRole('link', { name: 'Usar otro email' }).click()

  await expect(page).toHaveURL(/\/login\?/)
  expect(new URL(page.url()).searchParams.get('returnTo')).toBe(SETTINGS)
  await signInWithCodeAt(page, { email: NORTHWIND_MEMBER, path: page.url() })
  await expect(page).toHaveURL(new RegExp(`${SETTINGS}$`))
})

test('@id:access-91-1 a page with its query comes back whole', async ({ page }) => {
  const members = '/c/northwind/members?page=2'
  const login = await openSignedOut(page, members)

  await signInWithCodeAt(page, { email: NORTHWIND_MEMBER, path: login })

  await expect(page).toHaveURL(/\/c\/northwind\/members\?page=2$/)
  expect(pathOf(page)).toBe(members)
})

test('@id:access-91-2 signing in with Google comes back to the page I opened', async ({ page }) => {
  const login = await openSignedOut(page, SETTINGS)

  await signInWithGoogle(page, login)

  await expect(page).toHaveURL(new RegExp(`${SETTINGS}$`))
  expect(pathOf(page)).toBe(SETTINGS)
})

test('@id:access-91-3 a way back to another site is ignored when signing in with a code', async ({
  page,
}) => {
  const origin = new URL(test.info().project.use.baseURL ?? 'https://localhost').origin

  await signInWithCodeAt(page, { email: newEmail(), path: foreignLogin })

  // A new account has no company: where signing in leads without a way back.
  await expect(page).toHaveURL(/\/companies\/new$/)
  expect(new URL(page.url()).origin).toBe(origin)
})

test('@id:access-91-3 a way back to another site is ignored when signing in with Google', async ({
  page,
}) => {
  const origin = new URL(test.info().project.use.baseURL ?? 'https://localhost').origin
  await page.goto(foreignLogin)
  await expect(page.getByRole('link', { name: 'Continuar con Google' })).toHaveAttribute(
    'href',
    '/api/sessions/google',
  )

  await signInWithGoogle(page, foreignLogin)

  await expect(page).toHaveURL(/\/companies\/new$/)
  expect(new URL(page.url()).origin).toBe(origin)
})

for (const returnTo of ['//otro-sitio.example.com', '/\\otro-sitio.example.com', '/login']) {
  test(`@id:access-91-3 the way back "${returnTo}" is ignored`, async ({ page }) => {
    const origin = new URL(test.info().project.use.baseURL ?? 'https://localhost').origin

    await signInWithCodeAt(page, {
      email: NORTHWIND_MEMBER,
      path: `/login?returnTo=${encodeURIComponent(returnTo)}`,
    })

    // linked@example.com has several companies: where signing in leads without a way back.
    await expect(page).toHaveURL(/\/companies$/)
    expect(new URL(page.url()).origin).toBe(origin)
  })
}

test('@id:access-91-4 signed in, /login goes on to the page asked for without signing in again', async ({
  page,
}) => {
  await signInWithCodeAt(page, { email: NORTHWIND_MEMBER, path: '/login' })
  await expect(page).toHaveURL(/\/companies$/)

  await page.goto('/login?returnTo=/c/northwind')

  await expect(page).toHaveURL(/\/c\/northwind\/?$/)
  await expect(page.getByRole('textbox', { name: /email/i })).toHaveCount(0)
})
