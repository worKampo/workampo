import type { ApiErrorCode } from '../api-client'

// The i18n key of an error: access.invalid_code → access:errors.invalid_code (docs/design/content.md).
export function errorKey(code: ApiErrorCode) {
  if (code === 'unknown') return 'common:errors.unexpected' as const

  return `access:errors.${code.replace(/^access\./, '')}` as `access:errors.${string}`
}
