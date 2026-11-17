import assert from 'node:assert/strict'
import { readFileSync } from 'node:fs'
import { test } from 'node:test'
import { validate } from './check.mjs'

const valid = readFileSync(new URL('../../project.yaml', import.meta.url), 'utf8')

test('the real profile is valid', () => {
  assert.deepEqual(validate(valid), [])
})

test('rejects a token-shaped value', () => {
  const errors = validate(`${valid}\nleak: ghp_${'a'.repeat(36)}\n`)
  assert.ok(errors.some((e) => e.startsWith('looks like a secret')))
})

test('rejects an email that is not a GitHub noreply', () => {
  assert.ok(
    validate(valid.replace('workampo-dev@users.noreply.github.com', 'someone@example.com')).length,
  )
})

test('requires the three environments', () => {
  assert.ok(validate(valid.replace(/^ {2}stg:[\s\S]*?(?=^ {2}prod:)/m, '')).length)
})
