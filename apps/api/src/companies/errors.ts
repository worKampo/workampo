import type { ErrorCode } from '@workampo/domain/errors'
import { ProblemError } from '../_shared/http/problem-json'

type CompaniesErrorCode = Extract<ErrorCode, `companies.${string}`>

const COMPANIES_ERROR_STATUS: Record<CompaniesErrorCode, number> = {
  'companies.invalid_request': 400,
  'companies.invalid_slug': 400,
  'companies.reserved_slug': 400,
  'companies.user_name_required': 400,
  'companies.slug_taken': 409,
  'companies.idempotency_mismatch': 422,
  'companies.not_found': 404,
  'companies.too_many_creations': 429,
}

// The one error class of the companies domain: the code tells the cases apart.
export class CompaniesError extends ProblemError {
  override readonly code: CompaniesErrorCode

  constructor(code: CompaniesErrorCode, options?: ErrorOptions) {
    super({ code, status: COMPANIES_ERROR_STATUS[code] }, options)
    this.code = code
  }
}
