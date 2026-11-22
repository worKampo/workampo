import { expect, it } from 'vitest'
import { errorKey } from './errors'

it('an error code names its text in the access namespace, an unknown one the generic text', () => {
  expect(errorKey('access.invalid_code')).toBe('access:errors.invalid_code')
  expect(errorKey('unknown')).toBe('common:errors.unexpected')
})
