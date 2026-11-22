import { ApiError } from '@workampo/app-core/_shared/api-client'
import { errorKey } from '@workampo/app-core/access/errors'

// The i18n key of whatever an API call failed with.
export function errorMessageKey(error: unknown) {
  return errorKey(error instanceof ApiError ? error.code : 'unknown')
}
