import { SESSION_TTL_DAYS } from '@workampo/domain/access/session/session'
import type { Context } from 'hono'
import { deleteCookie, getCookie, setCookie } from 'hono/cookie'

// `host` prefix: __Host-session, Secure, Path=/ and no Domain, so no subdomain can read or set it.
const NAME = 'session'
const PREFIX = 'host'

export function setSessionCookie(c: Context, token: string) {
  setCookie(c, NAME, token, {
    prefix: PREFIX,
    httpOnly: true,
    secure: true,
    sameSite: 'Lax',
    path: '/',
    maxAge: SESSION_TTL_DAYS * 24 * 60 * 60,
  })
}

export function readSessionCookie(c: Context): string | undefined {
  return getCookie(c, NAME, PREFIX)
}

export function clearSessionCookie(c: Context) {
  deleteCookie(c, NAME, {
    prefix: PREFIX,
    httpOnly: true,
    secure: true,
    sameSite: 'Lax',
    path: '/',
  })
}
