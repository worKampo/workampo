import type { Context } from 'hono'
import { deleteCookie, getCookie, setCookie } from 'hono/cookie'

// __Host-oauth_state: ties the provider's answer to this browser for 10 minutes, used once.
const NAME = 'oauth_state'
const ATTRIBUTES = {
  prefix: 'host',
  httpOnly: true,
  secure: true,
  sameSite: 'Lax',
  path: '/',
} as const

export function setStateCookie(c: Context, state: string) {
  setCookie(c, NAME, state, { ...ATTRIBUTES, maxAge: 600 })
}

// Read and delete in one step: a second callback with the same state finds no cookie.
export function takeStateCookie(c: Context): string | undefined {
  const state = getCookie(c, NAME, 'host')
  deleteCookie(c, NAME, ATTRIBUTES)

  return state
}
