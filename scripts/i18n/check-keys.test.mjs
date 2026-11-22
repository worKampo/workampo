import assert from 'node:assert/strict'
import { test } from 'node:test'
import { keyErrors } from './check-keys.mjs'

const files = (entries) => new Map(Object.entries(entries))

test('the same files and keys in every language pass', () => {
  const locales = {
    en: files({ 'access.json': { errors: { a: 'A', b: 'B' } } }),
    es: files({ 'access.json': { errors: { b: 'B', a: 'A' } } }),
  }
  assert.deepEqual(keyErrors(locales), [])
})

test('a missing or extra key, a missing file or a language without files fail', () => {
  const locales = {
    en: files({ 'access.json': { errors: { a: 'A', b: 'B' } }, 'companies.json': { x: 'X' } }),
    es: files({ 'access.json': { errors: { a: 'A', c: 'C' } } }),
    ca: files({}),
  }
  assert.deepEqual(keyErrors(locales).sort(), [
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
  assert.deepEqual(keyErrors(locales), ['es/access.json misses title'])
})
