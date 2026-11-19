import assert from 'node:assert/strict'
import { test } from 'node:test'
import { check } from './branch.mjs'
import { context, failure, issueJson, logOf, RENOVATE } from './test-support.mjs'

const commits = [[/^git log/, logOf([{ sha: 'h1' }])]]

test('passes on a well-named branch of an open issue', () => {
  const ctx = context({ routes: [...commits, [/^gh api .*issues\/9 /, issueJson()]] })
  assert.deepEqual(check(ctx).errors, [])
})

test('fails on a bad name, a closed issue or a missing one', () => {
  const bad = context({ env: { HEAD_REF: 'feature/Invite' }, routes: commits })
  assert.match(check(bad).errors[0], /does not match/)
  const closed = context({ routes: [...commits, [/^gh api .*issues\/9 /, issueJson('closed')]] })
  assert.match(check(closed).errors[0], /closed, not open/)
  const missing = context({ routes: [...commits, [/^gh api/, failure(1, 'HTTP 404')]] })
  assert.match(check(missing).errors[0], /not an issue/)
})

test('Renovate is exempt; a renovate/ branch with other authors is not', () => {
  const bot = { sha: 'r1', email: RENOVATE, name: 'renovate[bot]' }
  const env = { HEAD_REF: 'renovate/all-minor' }
  assert.deepEqual(check(context({ env, routes: [[/^git log/, logOf([bot])]] })).errors, [])
  const mixed = context({ env, routes: [[/^git log/, logOf([bot, { sha: 'h1' }])]] })
  assert.equal(check(mixed).errors.length, 1)
})
