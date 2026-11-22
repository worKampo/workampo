import { expect, it } from 'vitest'
import { isAccessErrorCode } from './access/errors'
import { isErrorCode } from './errors'

it('recognises the error codes of the domains and nothing else', () => {
  expect(isErrorCode('access.invalid_code')).toBe(true)
  expect(isAccessErrorCode('access.invalid_code')).toBe(true)
  expect(isErrorCode('access.other')).toBe(false)
  expect(isErrorCode(undefined)).toBe(false)
})
