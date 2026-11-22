import type { AccessErrorCode } from '@workampo/domain/access/errors'

// Codes missing here never reach a JSON answer: the Google callback turns them into a redirect.
const STATUS_BY_CODE = {
  'access.invalid_email': 400,
  'access.invalid_code': 400,
  'access.too_many_code_requests': 429,
  'access.too_many_attempts': 429,
  'access.email_not_verified': 403,
  'access.contact_support': 409,
  'access.unauthenticated': 401,
} as const satisfies Partial<Record<AccessErrorCode, number>>

export type ProblemCode = keyof typeof STATUS_BY_CODE

// RFC 9457 with the stable `code` the interface translates.
export function problemJson(code: ProblemCode): Response {
  const status = STATUS_BY_CODE[code]

  return new Response(JSON.stringify({ type: 'about:blank', status, code }), {
    status,
    headers: { 'Content-Type': 'application/problem+json' },
  })
}

export function toProblem(error: unknown): Response | null {
  const code = error instanceof Error && 'code' in error ? error.code : undefined

  return isProblemCode(code) ? problemJson(code) : null
}

const isProblemCode = (code: unknown): code is ProblemCode =>
  typeof code === 'string' && Object.hasOwn(STATUS_BY_CODE, code)
