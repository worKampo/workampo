import { expect, test } from '@playwright/test'
import {
  expectSignedOut,
  newEmail,
  SESSION_COOKIE,
  sessionToken,
  signInWithCode,
  validCode,
} from './support'

test.use({ locale: 'es-ES' })

test('@id:access-96-13 the session cookie is __Host-, HttpOnly, Secure and SameSite=Lax and replaces the previous one', async ({
  page,
  request,
}) => {
  const email = newEmail()
  const answer = await signInWithCode(page, email)
  const setCookie = (await answer.headerValue('set-cookie')) ?? ''
  expect(setCookie).toMatch(new RegExp(`^${SESSION_COOKIE}=`))
  for (const attribute of [/HttpOnly/i, /Secure/i, /SameSite=Lax/i, /Path=\//i]) {
    expect(setCookie).toMatch(attribute)
  }
  expect(setCookie).not.toMatch(/Domain=/i)
  const previous = await sessionToken(page)

  // Signed in, /login goes on to the app (access-91-4), so the second sign-in calls the API from
  // the same browser, which still sends the previous session's cookie.
  await page.request.post('/api/sign-in-codes', { data: { email } })
  await page.request.post('/api/sessions', { data: { email, code: await validCode(email) } })

  const current = await sessionToken(page)
  expect(current).not.toBe(previous)
  const me = (token: string) =>
    request.get('/api/me', { headers: { Cookie: `${SESSION_COOKIE}=${token}` } })
  expect((await me(previous)).status()).toBe(401)
  expect((await me(current)).status()).toBe(200)
})

test('@id:access-96-14 signing out revokes the session', async ({ page, request }) => {
  await signInWithCode(page, newEmail())
  const token = await sessionToken(page)
  // A new account lands on the creation form; the sign-out button is on the picker.
  await expect(page).toHaveURL(/\/companies\/new$/)
  await page.getByRole('link', { name: 'Volver a mis empresas' }).click()
  await expect(page).toHaveURL(/\/companies$/)

  await page.getByRole('button', { name: 'Cerrar sesión' }).click()

  await expectSignedOut(page)
  const me = await request.get('/api/me', { headers: { Cookie: `${SESSION_COOKIE}=${token}` } })
  expect(me.status()).toBe(401)
})

test('@id:access-96-15 a session older than 30 days is no longer valid', async ({ page }) => {
  await page.goto('/login')
  // The seed's session of linked@example.com expired on 2026-01-31.
  await page.context().addCookies([
    {
      name: SESSION_COOKIE,
      value: 'seed-expired-session',
      url: new URL('/', page.url()).href,
      secure: true,
      httpOnly: true,
      sameSite: 'Lax',
    },
  ])

  await expectSignedOut(page)
})
