import type { Context } from 'hono'

// What the identity provider and the limits learn of a request: its IP and its browser.
export type RequestOrigin = { ipAddress: string; userAgent?: string | undefined }

// Cloudflare always sets CF-Connecting-IP; only local tools may lack it.
export function requestOrigin(c: Context): RequestOrigin {
  return {
    ipAddress: c.req.header('CF-Connecting-IP') ?? 'unknown',
    userAgent: c.req.header('User-Agent'),
  }
}
