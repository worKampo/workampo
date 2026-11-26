import { isErrorReference } from '@workampo/domain/_shared/api-errors'
import { type ErrorCode, isErrorCode } from '@workampo/domain/errors'

export type ApiErrorCode = ErrorCode | 'unknown'

// What hc's typed responses and a plain Response share.
type Answer = { ok: boolean; status: number; json(): Promise<unknown> }

export class ApiError extends Error {
  readonly code: ApiErrorCode
  readonly status: number
  readonly reference: string | undefined

  constructor({
    code,
    status,
    reference,
  }: { code: ApiErrorCode; status: number; reference?: string | undefined }) {
    super(code)
    this.code = code
    this.status = status
    this.reference = reference
  }
}

// Every call goes through here: a failure becomes an ApiError with the domain code the API sent.
export async function send<T extends Answer>(call: () => Promise<T>): Promise<T> {
  const response = await call().catch(() => {
    throw new ApiError({ code: 'unknown', status: 0 })
  })
  if (response.ok) return response

  const body: unknown = await response.json().catch(() => null)
  const problem = typeof body === 'object' && body !== null ? body : {}
  const code = 'code' in problem ? problem.code : null
  const reference = 'reference' in problem ? problem.reference : null

  throw new ApiError({
    code: isErrorCode(code) ? code : 'unknown',
    status: response.status,
    // Only a server failure carries a reference the 500 page may show (ticket 93, R1).
    reference: response.status >= 500 && isErrorReference(reference) ? reference : undefined,
  })
}
