import assert from 'node:assert/strict'
import { test } from 'node:test'
import { checkHealth } from './smoke.mjs'
import {
  buildComment,
  messagesLogArgs,
  parsePrNumber,
  parseRefs,
  postComments,
} from './verification-comment.mjs'

test('parseRefs reads one, several or no Refs trailer', () => {
  assert.deepEqual(parseRefs('feat: x (#12)\n\nbody\n\nRefs: #7\n'), [7])
  assert.deepEqual(parseRefs('feat: x\n\nRefs: #7\nRefs: #9'), [7, 9])
  assert.deepEqual(parseRefs('chore: bump deps\n\nno ticket here, see #5'), [])
})

test('parseRefs matches within one line only', () => {
  assert.deepEqual(parseRefs('feat: x\n\nRefs:\n#12\n'), [])
  assert.deepEqual(parseRefs('feat: x\n\nRefs: \n\n#12\n'), [])
  assert.deepEqual(parseRefs('feat: x\n\nRefs: #12 \t \n'), [12])
  assert.deepEqual(parseRefs('feat: x\n\nRefs:\t#12\n'), [12])
  assert.deepEqual(parseRefs('feat: x\r\n\r\nRefs: #12\r\nRefs: #13\r\n'), [12, 13])
})

test('parseRefs deduplicates the trailers of several commits', () => {
  const log = 'feat: a\n\nRefs: #7\n\nfix: b\n\nRefs: #9\n\nfix: c\n\nRefs: #7\n'
  assert.deepEqual(parseRefs(log), [7, 9])
})

test('messagesLogArgs reads the whole deployed range when the previous SHA is known', () => {
  assert.deepEqual(messagesLogArgs('bbb', 'aaa'), ['log', 'aaa..bbb', '--format=%B'])
  assert.deepEqual(messagesLogArgs('bbb', ''), ['log', '-1', '--format=%B', 'bbb'])
  assert.deepEqual(messagesLogArgs('bbb', undefined), ['log', '-1', '--format=%B', 'bbb'])
})

test('postComments keeps going after a failed issue and returns the failures', (t) => {
  t.mock.method(console, 'error', () => {})
  const posted = []
  const failed = postComments([3, 5, 8], (issue) => {
    if (issue === 5) throw new Error('boom')
    posted.push(issue)
  })
  assert.deepEqual(posted, [3, 8])
  assert.deepEqual(failed, [5])
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
