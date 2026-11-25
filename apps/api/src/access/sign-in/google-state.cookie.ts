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

// `state` or `state.<returnTo>`: the state is base64url, so the first dot ends it. Unsigned, so
// the reader checks returnTo again.
export function setStateCookie(
  c: Context,
  { state, returnTo }: { state: string; returnTo?: string | undefined },
) {
  const value = returnTo === undefined ? state : `${state}.${returnTo}`
  setCookie(c, NAME, value, { ...ATTRIBUTES, maxAge: 600 })
}

// Read and delete in one step: a second callback with the same state finds no cookie.
export function takeStateCookie(c: Context): { state?: string; returnTo?: string } {
  const value = getCookie(c, NAME, 'host')
  deleteCookie(c, NAME, ATTRIBUTES)
  if (value === undefined) return {}

  const dot = value.indexOf('.')
  if (dot === -1) return { state: value }

  return { state: value.slice(0, dot), returnTo: value.slice(dot + 1) }
}
