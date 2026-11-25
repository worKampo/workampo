import { expect, type Page } from '@playwright/test'

// Contract of the fake identity provider: this code is valid, `000000` is expired, any other is wrong.
export const FAKE_VALID_CODE = '424242'
export const FAKE_EXPIRED_CODE = '000000'

export const RESEND = /reenviar|otro código/i
export const WAIT = /esper/i
export const SESSION_COOKIE = '__Host-session'

// Smoke mode: Playwright runs against a deployed environment, where WorkOS is the real provider.
const isStaging = Boolean(process.env.E2E_BASE_URL)

export const newEmail = () => `new-${crypto.randomUUID()}@example.com`

/** Locally the fake's code; on staging a Magic Auth code created with the WorkOS API (the last one wins). */
async function validCode(email: string): Promise<string> {
  if (!isStaging) return FAKE_VALID_CODE
  const key = process.env.WORKOS_API_KEY
  if (!key) throw new Error('WORKOS_API_KEY is required when E2E_BASE_URL is set')
  const response = await fetch('https://api.workos.com/user_management/magic_auth', {
    method: 'POST',
    headers: { Authorization: `Bearer ${key}`, 'Content-Type': 'application/json' },
    body: JSON.stringify({ email }),
  })
  expect(response.ok).toBe(true)
  const { code } = (await response.json()) as { code: string }
  return code
}

/** /login → "Continuar" → code screen naming the email. Returns the API answer to the request. */
export function requestCode(page: Page, email: string) {
  return requestCodeAt(page, { email, path: '/login' })
}

// From `path`, so a /login?returnTo=… keeps its way back.
async function requestCodeAt(page: Page, { email, path }: { email: string; path: string }) {
  await page.goto(path)
  await page.getByRole('textbox').fill(email)
  const [answer] = await Promise.all([
    page.waitForResponse((r) => r.url().endsWith('/api/sign-in-codes')),
    page.getByRole('button', { name: 'Continuar', exact: true }).click(),
  ])
  await expect(page.getByText(email)).toBeVisible()
  return answer
}

/** Types a code on the code screen and returns the API answer to it. */
export async function enterCode(page: Page, code: string) {
  const field = page.getByRole('textbox')
  await field.fill(code)
  const [answer] = await Promise.all([
    page.waitForResponse(
      (r) => r.url().endsWith('/api/sessions') && r.request().method() === 'POST',
    ),
    field.press('Enter'),
  ])
  return answer
}

export function signInWithCode(page: Page, email: string) {
  return signInWithCodeAt(page, { email, path: '/login' })
}

/** Signs in from `path`, such as the /login?returnTo=… an app page led to. */
export async function signInWithCodeAt(page: Page, at: { email: string; path: string }) {
  await requestCodeAt(page, at)
  return enterCode(page, await validCode(at.email))
}

export async function signInWithGoogle(page: Page, path = '/login') {
  await page.goto(path)
  await page.getByRole('link', { name: 'Continuar con Google' }).click()
}

export async function currentUser(page: Page) {
  const response = await page.request.get('/api/me')
  expect(response.status()).toBe(200)
  return (await response.json()) as { id: string; email: string }
}

export async function sessionToken(page: Page) {
  const cookie = (await page.context().cookies()).find((c) => c.name === SESSION_COOKIE)
  if (!cookie) throw new Error(`no ${SESSION_COOKIE} cookie`)
  return cookie.value
}

export async function expectSignedOut(page: Page) {
  await page.goto('/')
  await expect(page).toHaveURL(/\/login$/)
}
