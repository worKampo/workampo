import type { ErrorCode } from '@workampo/domain/errors'
import { ApiError } from './api-error'

// Generic, so the conditional distributes over each code; on the bare union it would pair every domain with every reason.
type KeyOf<Code> = Code extends `${infer Domain}.${infer Reason}`
  ? `${Domain}:errors.${Reason}`
  : never
type ErrorKey = KeyOf<ErrorCode>

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

// A 4xx answer will not change on a retry; only network failures and 5xx are worth three more tries.
export function shouldRetry(failureCount: number, error: unknown) {
  const isClientError = error instanceof ApiError && error.status >= 400 && error.status < 500

  return !isClientError && failureCount < 3
}
