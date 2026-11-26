import type { Context, MiddlewareHandler } from 'hono'
import { bodyLimit } from 'hono/body-limit'
import { HTTPException } from 'hono/http-exception'
import { newErrorReference } from '../crypto/error-reference'
import { tagErrorReference } from '../error-tracking/sentry-error-tracking'
import { windowEnd, windowStart } from '../rate-limit/window'
import type { AppEnv } from './app-env'
import { problemJson } from './problem-json'

const MAX_BODY_BYTES = 100 * 1024
// Cloudflare's ray id: hex, a dash and the colo; anything else is not logged, so the header cannot inject fields.
const CF_RAY = /^[0-9a-f]{16}-[A-Z]{3}$/

export const apiBodyLimit = bodyLimit({
  maxSize: MAX_BODY_BYTES,
  onError: () => problemJson({ code: 'api.body_too_large', status: 413 }),
})

// Runs after the route, so it also sees the 429 of any domain.
export const apiResponseHeaders: MiddlewareHandler<AppEnv> = async (c, next) => {
  await next()

  c.header('Cache-Control', 'no-store')
  c.header('X-Content-Type-Options', 'nosniff')
  if (c.res.status === 429) {
    const seconds = c.var.env.RATE_LIMIT_WINDOW_SECONDS
    const now = new Date()
    const end = windowEnd(windowStart(now, seconds), seconds)
    c.header('Retry-After', String(Math.max(1, Math.ceil((end.getTime() - now.getTime()) / 1000))))
  }
}

export function apiNotFound(c: Context<AppEnv>): Response {
  const { pathname } = new URL(c.req.url)

  return pathname === '/api' || pathname.startsWith('/api/')
    ? problemJson({ code: 'api.not_found', status: 404 })
    : c.text('404 Not Found', 404)
}

// Domain routers convert their own errors; this covers what Hono raises before them.
export function apiOnError(error: Error, c: Context<AppEnv>): Response {
  if (error instanceof HTTPException) {
    return error.status === 400 && error.message.startsWith('Malformed JSON')
      ? problemJson({ code: 'api.malformed_json', status: 400 })
      : error.getResponse()
  }
  // The message may hold personal data: Sentry keeps it from c.error, the log only the reference.
  const reference = newErrorReference()
  c.set('errorReference', reference)
  tagErrorReference(reference)
  const cfRay = c.req.header('cf-ray')
  const company = (c.var as { company?: { tenantId: string } }).company
  const code = 'api.unexpected'
  console.error(
    JSON.stringify({
      reference,
      cfRay: cfRay && CF_RAY.test(cfRay) ? cfRay : null,
      code,
      companyId: company?.tenantId ?? null,
    }),
  )
  const { pathname } = new URL(c.req.url)

  return pathname === '/api' || pathname.startsWith('/api/')
    ? problemJson({ code, status: 500, reference })
    : c.text('Internal Server Error', 500)
}
