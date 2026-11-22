import type { ErrorCode } from '@workampo/domain/errors'
import { ApiError } from './api-client'

type ErrorKey = ErrorCode extends `${infer Domain}.${infer Reason}`
  ? `${Domain}:errors.${Reason}`
  : never

// The i18n key of an error: access.invalid_code → access:errors.invalid_code (docs/design/content.md).
export function errorKey(code: ErrorCode | 'unknown'): ErrorKey | 'common:errors.unexpected' {
  if (code === 'unknown') return 'common:errors.unexpected'

  const [domain, reason] = code.split('.')

  return `${domain}:errors.${reason}` as ErrorKey
}

// Whatever an API call failed with, as the key of its text.
export function errorKeyOf(error: unknown) {
  return errorKey(error instanceof ApiError ? error.code : 'unknown')
}
