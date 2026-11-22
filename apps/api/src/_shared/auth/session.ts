import { isSessionValid } from '@workampo/domain/access/session'
import { createMiddleware } from 'hono/factory'
import type { AppEnv } from '../http/app-env'
import { problemJson } from '../http/problem-json'
import { readSessionCookie } from './session-cookie'
import { sessionRepo } from './session-repo'
import { hashSessionToken } from './session-token'

export type SessionVariables = { session: { id: string; userId: string } }

// The one place a request's session is resolved (ADR-0057): the cookie now, a Bearer token with the app.
export const requireSession = createMiddleware<AppEnv & { Variables: SessionVariables }>(
  async (c, next) => {
    const token = readSessionCookie(c)
    const session = token
      ? await sessionRepo(c.env).findByTokenHash(await hashSessionToken(token))
      : undefined
    if (!session || !isSessionValid(session, new Date()))
      return problemJson('access.unauthenticated')
    c.set('session', { id: session.id, userId: session.userId })
    await next()
  },
)
