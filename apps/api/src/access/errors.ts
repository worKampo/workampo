import type { AccessErrorCode } from '@workampo/domain/access/errors'
import { ProblemError } from '../_shared/http/problem-json'

// invalid_state and google_failed reach the person as a redirect from the Google callback.
const ACCESS_ERROR_STATUS: Record<AccessErrorCode, number> = {
  'access.invalid_email': 400,
  'access.invalid_code': 400,
  'access.too_many_code_requests': 429,
  'access.too_many_attempts': 429,
  'access.email_not_verified': 403,
  'access.contact_support': 409,
  'access.invalid_state': 400,
  'access.google_failed': 502,
  'access.unauthenticated': 401,
}

// The one error class of the access domain: the code tells the cases apart.
export class AccessError extends ProblemError {
  override readonly code: AccessErrorCode

  constructor(code: AccessErrorCode, options?: ErrorOptions) {
    super({ code, status: ACCESS_ERROR_STATUS[code] }, options)
    this.code = code
  }
}
