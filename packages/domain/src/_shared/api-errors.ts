// Errors of the HTTP layer itself, owned by no domain.
export const API_ERROR_CODES = [
  'api.malformed_json',
  'api.not_found',
  'api.body_too_large',
  'api.unexpected',
] as const

// The reference of a server failure: XXXX-XXXX in Crockford base32 (ticket 93, R1).
export const ERROR_REFERENCE = /^[0-9A-HJKMNP-TV-Z]{4}-[0-9A-HJKMNP-TV-Z]{4}$/

export function isErrorReference(value: unknown): value is string {
  return typeof value === 'string' && ERROR_REFERENCE.test(value)
}
