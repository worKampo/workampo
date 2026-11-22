import type { AccessErrorCode } from '@workampo/domain/access/errors'
import type { ApiErrorCode } from '../_shared/api-client'

type AccessErrorKey = AccessErrorCode extends `access.${infer Reason}`
  ? `access:errors.${Reason}`
  : never

// The i18n key of an error: access.invalid_code → access:errors.invalid_code (docs/design/content.md).
export function errorKey(code: ApiErrorCode): AccessErrorKey | 'common:errors.unexpected' {
  if (code === 'unknown') return 'common:errors.unexpected'

  return `access:errors.${code.replace(/^access\./, '')}` as AccessErrorKey
}
