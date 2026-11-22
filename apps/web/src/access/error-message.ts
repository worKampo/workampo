import { ApiError } from '@workampo/client/_shared/api-client'
import { errorKey } from '@workampo/client/access/errors'

// The i18n key of whatever an API call failed with.
export function errorMessageKey(error: unknown) {
  return errorKey(error instanceof ApiError ? error.code : 'unknown')
}
