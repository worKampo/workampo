import { expect, it } from 'vitest'
import { ApiError } from './api-error'
import { errorKey, errorKeyOf, shouldRetry } from './error-key'

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

it('retries network failures and 5xx up to three times, never a 4xx', () => {
  expect(shouldRetry(0, new ApiError({ code: 'unknown', status: 0 }))).toBe(true)
  expect(shouldRetry(2, new ApiError({ code: 'unknown', status: 503 }))).toBe(true)
  expect(shouldRetry(3, new ApiError({ code: 'unknown', status: 503 }))).toBe(false)
  expect(shouldRetry(0, new ApiError({ code: 'companies.not_found', status: 404 }))).toBe(false)
})
