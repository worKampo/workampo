import assert from 'node:assert/strict'
import { test } from 'node:test'
import { checkHealth } from './smoke.mjs'
import { buildComment, parsePrNumber, parseRefs } from './verification-comment.mjs'

test('parseRefs reads one, several or no Refs trailer', () => {
  assert.deepEqual(parseRefs('feat: x (#12)\n\nbody\n\nRefs: #7\n'), [7])
  assert.deepEqual(parseRefs('feat: x\n\nRefs: #7\nRefs: #9'), [7, 9])
  assert.deepEqual(parseRefs('chore: bump deps\n\nno ticket here, see #5'), [])
})

test('parsePrNumber reads the squash suffix of the subject', () => {
  assert.equal(parsePrNumber('feat: deploy (#42)'), 42)
  assert.equal(parsePrNumber('feat: deploy'), null)
  assert.equal(parsePrNumber('fix (#3) later'), null)
})

const base = {
  url: 'https://x.test',
  sha: 'abc123',
  deployedAt: '2026-01-01T00:00:00.000Z',
  smokeResult: 'passed',
}

test('buildComment titles stg and prod and includes the PR when known', () => {
  const stg = buildComment({ ...base, env: 'stg', prNumber: 42 })
  assert.match(stg, /^## Staging verification/)
  assert.match(stg, /- PR: #42/)
  assert.match(stg, /- SHA: abc123/)
  const prod = buildComment({ ...base, env: 'prod', prNumber: null })
  assert.match(prod, /^## Release verification/)
  assert.doesNotMatch(prod, /PR:/)
})

test('checkHealth accepts only 200, status ok and the expected sha', () => {
  assert.equal(checkHealth(200, { status: 'ok', sha: 'abc' }, 'abc').ok, true)
  assert.equal(checkHealth(200, { status: 'ok', sha: 'old' }, 'abc').ok, false)
  assert.equal(checkHealth(503, { status: 'ok', sha: 'abc' }, 'abc').ok, false)
  assert.equal(checkHealth(200, null, 'abc').ok, false)
})
