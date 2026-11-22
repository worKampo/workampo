export const ACCESS_ERROR_CODES = [
  'access.invalid_email',
  'access.invalid_code',
  'access.too_many_code_requests',
  'access.too_many_attempts',
  'access.email_not_verified',
  'access.contact_support',
  'access.invalid_state',
  'access.google_failed',
  'access.unauthenticated',
] as const

export type AccessErrorCode = (typeof ACCESS_ERROR_CODES)[number]
