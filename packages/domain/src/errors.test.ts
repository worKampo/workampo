import { expect, it } from 'vitest'
import { isAccessErrorCode } from './access/errors'
import { isErrorCode } from './errors'

it('recognises the error codes of the domains and nothing else', () => {
  expect(isErrorCode('access.invalid_code')).toBe(true)
  expect(isAccessErrorCode('access.invalid_code')).toBe(true)
  expect(isErrorCode('access.other')).toBe(false)
  expect(isErrorCode(undefined)).toBe(false)
})

// A specifier Vite does not resolve ahead, so the file loads before T3 adds the exports; turn it
// into a static import when the it.fails marks go.
const ERRORS = './errors'
const loadErrors = () => import(/* @vite-ignore */ ERRORS)

it.fails('the error reference format is XXXX-XXXX in Crockford base32 (ticket 93, R1)', async () => {
  const { ERROR_REFERENCE } = await loadErrors()

  expect(ERROR_REFERENCE.source).toBe('^[0-9A-HJKMNP-TV-Z]{4}-[0-9A-HJKMNP-TV-Z]{4}$')
  expect(ERROR_REFERENCE.flags).toBe('')
})

it.fails('recognises an error reference and nothing else (ticket 93, X1)', async () => {
  const { isErrorReference } = await loadErrors()

  for (const valid of ['7F3K-92QD', '0000-ZZZZ', 'ABCD-EFGH']) {
    expect(isErrorReference(valid)).toBe(true)
  }
  const invalid = [
    '7f3k-92qd',
    '7F3K92QD',
    '7F3K-92Q',
    '7F3K-92QDX',
    ' 7F3K-92QD',
    '7F3K-92QD\n',
    'IL0U-7F3K',
    '7F3K_92QD',
    '７F3K-92QD',
    '<b>x</b>',
    '',
    undefined,
    null,
    12345678,
    ['7F3K-92QD'],
  ]
  for (const value of invalid) {
    expect(isErrorReference(value)).toBe(false)
  }
})
