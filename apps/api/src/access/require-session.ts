import { isSessionValid } from '@workampo/domain/access/session/session'
import { createMiddleware } from 'hono/factory'
import type { AppEnv } from '../_shared/http/app-env'
import { problemJson } from '../_shared/http/problem-json'
import { readSessionCookie } from './session/session-cookie'
import { sessionRepo } from './session/session-repo'
import { hashSessionToken } from './session/session-token'

export type SessionVariables = { session: { id: string; userId: string } }

// The one place a request's session is resolved (ADR-0057): the cookie now, a Bearer token with the app.
export const requireSession = createMiddleware<AppEnv & { Variables: SessionVariables }>(
  async (c, next) => {
    const token = readSessionCookie(c)
    const session = token
      ? await sessionRepo(c.env).findByTokenHash(await hashSessionToken(token))
      : undefined

    if (!session || !isSessionValid(session, new Date()))
      return problemJson({ code: 'access.unauthenticated', status: 401 })

    c.set('session', { id: session.id, userId: session.userId })
    await next()
  },
)
