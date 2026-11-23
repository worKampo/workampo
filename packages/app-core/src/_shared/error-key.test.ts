import { expect, it } from 'vitest'
import { ApiError } from './api-error'
import { errorKey, errorKeyOf } from './error-key'

it('an error code names its text in its domain namespace, an unknown one the generic text', () => {
  expect(errorKey('access.invalid_code')).toBe('access:errors.invalid_code')
  expect(errorKey('unknown')).toBe('common:errors.unexpected')
})

it('a failed call gives the key of its code, anything else the generic text', () => {
  expect(errorKeyOf(new ApiError({ code: 'access.too_many_attempts', status: 429 }))).toBe(
    'access:errors.too_many_attempts',
  )
  expect(errorKeyOf(new TypeError('offline'))).toBe('common:errors.unexpected')
})
