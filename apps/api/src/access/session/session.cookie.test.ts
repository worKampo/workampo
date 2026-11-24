import { Hono } from 'hono'
import { describe, expect, it } from 'vitest'
import { clearSessionCookie, readSessionCookie, setSessionCookie } from './session.cookie'

const app = new Hono()
  .get('/set', (c) => {
    setSessionCookie(c, 'token-1')
    return c.body(null, 204)
  })
  .get('/clear', (c) => {
    clearSessionCookie(c)
    return c.body(null, 204)
  })
  .get('/read', (c) => c.text(readSessionCookie(c) ?? 'none'))

describe('the session cookie', () => {
  it('@id:access-96-13 is __Host-, HttpOnly, Secure, SameSite=Lax, Path=/, 30 days, no Domain', async () => {
    const cookie = (await app.request('/set')).headers.get('Set-Cookie') ?? ''

    expect(cookie).toMatch(/^__Host-session=token-1;/)
    for (const attribute of ['HttpOnly', 'Secure', 'SameSite=Lax', 'Path=/', 'Max-Age=2592000'])
      expect(cookie.split('; ')).toContain(attribute)
    expect(cookie).not.toMatch(/Domain/i)
  })

  it('@id:access-96-14 is cleared on sign-out', async () => {
    const cookie = (await app.request('/clear')).headers.get('Set-Cookie') ?? ''

    expect(cookie).toMatch(/^__Host-session=;/)
    expect(cookie.split('; ')).toContain('Max-Age=0')
  })

  it('is read back from the request', async () => {
    const response = await app.request('/read', { headers: { Cookie: '__Host-session=token-1' } })

    expect(await response.text()).toBe('token-1')
    expect(await (await app.request('/read')).text()).toBe('none')
  })
})
