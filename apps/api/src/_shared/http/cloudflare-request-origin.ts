import type { Context } from 'hono'
import type { RequestOrigin } from './request-origin'

// Cloudflare always sets CF-Connecting-IP; only local tools may lack it.
export function requestOrigin(c: Context): RequestOrigin {
  return {
    ipAddress: c.req.header('CF-Connecting-IP') ?? 'unknown',
    userAgent: c.req.header('User-Agent'),
  }
}
