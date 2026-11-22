import type { ErrorCode } from '@workampo/domain/errors'

// A domain error with its stable code and HTTP status; each domain's errors.ts extends it.
export class ProblemError extends Error {
  readonly code: ErrorCode
  readonly status: number

  constructor({ code, status }: { code: ErrorCode; status: number }, options?: ErrorOptions) {
    super(code, options)
    this.code = code
    this.status = status
  }
}

// RFC 9457 with the stable `code` the interface translates.
export function problemJson({ code, status }: { code: ErrorCode; status: number }): Response {
  return new Response(JSON.stringify({ type: 'about:blank', status, code }), {
    status,
    headers: { 'Content-Type': 'application/problem+json' },
  })
}

export function toProblem(error: unknown): Response | null {
  return error instanceof ProblemError ? problemJson(error) : null
}
