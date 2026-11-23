import type { AppType } from '@workampo/api/contract'
import { hc } from 'hono/client'

// fetch is injected: the web passes the browser's, the mobile app its own, tests a fake.
export function createApiClient({
  baseUrl,
  clientVersion,
  fetch,
}: {
  baseUrl: string
  clientVersion: string
  fetch: typeof globalThis.fetch
}) {
  return hc<AppType>(baseUrl, { fetch, headers: { 'X-Client-Version': clientVersion } })
}

export type ApiClient = ReturnType<typeof createApiClient>
