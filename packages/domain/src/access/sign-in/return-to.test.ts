import { describe, expect, it } from 'vitest'

import { safeReturnTo } from './return-to'

const ACCEPTED = [
  '/c/northwind/settings',
  '/c/northwind/members?page=2',
  '/c/northwind/members?page=2&pageSize=50',
  '/',
  '/companies',
  '/companies/new',
]

// Each one, followed by a browser or resolved against our origin, could leave worKampo, loop back to
// sign-in or land on JSON (Security 1 of ticket 91).
const REFUSED: [string, unknown][] = [
  ['protocol-relative', '//x'],
  ['protocol-relative to a host', '//otro-sitio.example.com/c/northwind'],
  ['slash backslash', '/\\x'],
  ['backslash slash', '\\/x'],
  ['a backslash anywhere', '/c/northwind\\..\\x'],
  ['a tab the browser drops', '/\t/x'],
  ['a newline the browser drops', '/\n/x'],
  ['a carriage return', '/\r/x'],
  ['a space', '/ /x'],
  ['a leading space', ' /c/northwind'],
  ['a NUL', '/c/\u0000northwind'],
  ['a DEL', '/c/\u007fnorthwind'],
  ['an encoded slash', '/%2F%2Fx'],
  ['an encoded slash in lower case', '/%2f%2fx'],
  ['an encoded backslash', '/%5Cx'],
  ['an encoded backslash in lower case', '/%5cx'],
  ['an encoded control character', '/%09/x'],
  ['an encoded newline', '/%0a/x'],
  ['an encoded escape character', '/%1b/x'],
  ['a dot-dot segment that resolves to sign-in', '/c/../login'],
  ['a dot segment', '/c/./northwind'],
  ['an encoded dot-dot segment that resolves to the API', '/c/%2e%2e/api/x'],
  ['an absolute URL', 'https://otro-sitio.example.com'],
  ['an absolute URL to our own path', 'https://otro-sitio.example.com/c/northwind'],
  ['javascript:', 'javascript:alert(1)'],
  ['data:', 'data:text/html,<script>alert(1)</script>'],
  ['a scheme with one slash', 'http:/x'],
  ['a scheme with no slash', 'http:x'],
  ['a relative path', 'c/northwind'],
  ['a dot path', './c/northwind'],
  ['the empty string', ''],
  ['undefined', undefined],
  ['null', null],
  ['a number', 42],
  ['an array', ['/c/northwind']],
  ['an object', { href: '/c/northwind' }],
  ['the API', '/api/x'],
  ['the API root', '/api/'],
  ['sign-in', '/login'],
  ['the code screen', '/login/code'],
  ['sign-in with its own way back', '/login?returnTo=%2Fc%2Fnorthwind'],
]

describe('safeReturnTo', () => {
  for (const path of ACCEPTED)
    it(`@id:access-91-1 keeps the path of the app "${path}"`, () => {
      expect(safeReturnTo(path)).toBe(path)
    })

  for (const [what, value] of REFUSED)
    it(`@id:access-91-3 ignores ${what}`, () => {
      expect(safeReturnTo(value)).toBeUndefined()
    })

  it('@id:access-91-3 accepts up to 1024 characters and ignores 1025', () => {
    const at = (length: number) => `/c/northwind/${'a'.repeat(length - '/c/northwind/'.length)}`

    expect(at(1024)).toHaveLength(1024)
    expect(safeReturnTo(at(1024))).toBe(at(1024))
    expect(safeReturnTo(at(1025))).toBeUndefined()
  })

  it('@id:access-91-1 keeps unicode and its percent-encoding', () => {
    expect(safeReturnTo('/c/northwind/búsqueda?q=Ñandú')).toBe('/c/northwind/búsqueda?q=Ñandú')
    expect(safeReturnTo('/c/northwind/b%C3%BAsqueda')).toBe('/c/northwind/b%C3%BAsqueda')
  })

  it('@id:access-91-1 does not refuse paths that only start like /api or /login', () => {
    expect(safeReturnTo('/c/api')).toBe('/c/api')
    expect(safeReturnTo('/c/northwind/login')).toBe('/c/northwind/login')
  })
})
