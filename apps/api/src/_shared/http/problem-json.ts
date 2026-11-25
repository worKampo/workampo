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

const REASON_PHRASES: Record<number, string> = {
  400: 'Bad Request',
  401: 'Unauthorized',
  403: 'Forbidden',
  404: 'Not Found',
  409: 'Conflict',
  413: 'Payload Too Large',
  415: 'Unsupported Media Type',
  422: 'Unprocessable Content',
  429: 'Too Many Requests',
  500: 'Internal Server Error',
  502: 'Bad Gateway',
  503: 'Service Unavailable',
}

// RFC 9457 with the stable `code` the interface translates.
export function problemJson({ code, status }: { code: ErrorCode; status: number }): Response {
  const title = REASON_PHRASES[status]

  return new Response(JSON.stringify({ type: 'about:blank', title, status, code }), {
    status,
    headers: { 'Content-Type': 'application/problem+json' },
  })
}

export function toProblem(error: unknown): Response | null {
  return error instanceof ProblemError ? problemJson(error) : null
}
