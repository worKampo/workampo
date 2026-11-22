import assert from 'node:assert/strict'
import { test } from 'node:test'
import { contextErrors, keyErrors } from './check-keys.mjs'

const files = (entries) => new Map(Object.entries(entries))

test('the same files and keys in every language pass', () => {
  const locales = {
    en: files({ 'access.json': { errors: { a: 'A', b: 'B' } } }),
    es: files({ 'access.json': { errors: { b: 'B', a: 'A' } } }),
  }

  const errors = keyErrors(locales)

  assert.deepEqual(errors, [])
})

test('a missing or extra key, a missing file or a language without files fail', () => {
  const locales = {
    en: files({ 'access.json': { errors: { a: 'A', b: 'B' } }, 'companies.json': { x: 'X' } }),
    es: files({ 'access.json': { errors: { a: 'A', c: 'C' } } }),
    ca: files({}),
  }

  const errors = keyErrors(locales).sort()

  assert.deepEqual(errors, [
    'ca/access.json is missing',
    'ca/companies.json is missing',
    'es/access.json has errors.c, which en does not',
    'es/access.json misses errors.b',
    'es/companies.json is missing',
  ])
})

test('an empty text counts as missing', () => {
  const locales = {
    en: files({ 'access.json': { title: 'Title' } }),
    es: files({ 'access.json': { title: '' } }),
  }

  const errors = keyErrors(locales)

  assert.deepEqual(errors, ['es/access.json misses title'])
})

test('the translators context is not a language', () => {
  const locales = {
    en: files({ 'access.json': { login: { title: 'Sign in' } } }),
    _context: files({ 'access.json': { login: { _screen: 'The sign-in screen' } } }),
  }

  const errors = keyErrors(locales)

  assert.deepEqual(errors, [])
})

test('every screen group of en needs its _screen in the context', () => {
  const locales = {
    en: files({
      'access.json': { login: { title: 'Sign in' }, errors: { a: 'A' } },
      'common.json': { states: { loading: 'Loading' } },
    }),
    _context: files({ 'access.json': { login: { _screen: 'The sign-in screen' }, errors: {} } }),
  }

  const errors = contextErrors(locales).sort()

  assert.deepEqual(errors, [
    '_context/access.json has no _screen for errors',
    '_context/common.json is missing',
  ])
})
