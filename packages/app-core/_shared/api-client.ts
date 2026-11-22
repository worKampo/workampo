import type { AppType } from '@workampo/api/contract'
import { type ErrorCode, isErrorCode } from '@workampo/domain/errors'
import { hc } from 'hono/client'

export type ApiErrorCode = ErrorCode | 'unknown'

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

// What hc's typed responses and a plain Response share.
type Answer = { ok: boolean; status: number; json(): Promise<unknown> }

export class ApiError extends Error {
  readonly code: ApiErrorCode
  readonly status: number

  constructor({ code, status }: { code: ApiErrorCode; status: number }) {
    super(code)
    this.code = code
    this.status = status
  }
}

// Every call goes through here: a failure becomes an ApiError with the domain code the API sent.
export async function send<T extends Answer>(call: () => Promise<T>): Promise<T> {
  const response = await call().catch(() => {
    throw new ApiError({ code: 'unknown', status: 0 })
  })
  if (response.ok) return response

  throw new ApiError({ code: await problemCode(response), status: response.status })
}

async function problemCode(response: Answer): Promise<ApiErrorCode> {
  const body: unknown = await response.json().catch(() => null)
  const code = typeof body === 'object' && body !== null && 'code' in body ? body.code : null

  return isErrorCode(code) ? code : 'unknown'
}
