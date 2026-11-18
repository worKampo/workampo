import assert from 'node:assert/strict'
import { test } from 'node:test'
import { check, parseCriticalPaths } from './size.mjs'
import { context, failure, issueJson, logOf, RENOVATE } from './test-support.mjs'

const CRITICAL =
  '# Critical paths\n\n- `packages/db/migrations/**`\n- `apps/*/src/_shared/auth/**`\n'

function ctxWith({ labels, files, critical = CRITICAL }) {
  return context({
    routes: [
      [/^git log/, logOf([{ sha: 'h1' }])],
      [/^gh api .*issues\/9 /, issueJson('open', labels)],
      [/^git diff --name-only/, files.join('\n')],
      [/^git show head:docs\/procedures\/critical-paths.md/, critical ?? failure(128)],
    ],
  })
}

test('reads globs from "- `glob`" lines only', () => {
  assert.deepEqual(parseCriticalPaths('- `a/**`\ntext `b`\n  - `c`\n- `d/*.ts` why'), [
    'a/**',
    'd/*.ts',
  ])
  assert.deepEqual(parseCriticalPaths(null), [])
})

test('passes with size:M outside critical paths and size:L inside', () => {
  assert.deepEqual(check(ctxWith({ labels: ['size:M'], files: ['apps/api/src/x.ts'] })).errors, [])
  const migration = ['packages/db/migrations/0001_create_x.sql']
  assert.deepEqual(check(ctxWith({ labels: ['size:L'], files: migration })).errors, [])
})

test('fails without size: and below L on a critical path', () => {
  assert.match(check(ctxWith({ labels: [], files: [] })).errors[0], /no size: label/)
  const auth = ['apps/api/src/_shared/auth/session.ts']
  assert.match(check(ctxWith({ labels: ['size:M'], files: auth })).errors[0], /needs size:L/)
})

test('a missing critical-paths file is an empty list', () => {
  const ctx = ctxWith({ labels: ['size:S'], files: ['packages/db/x.sql'], critical: null })
  assert.deepEqual(check(ctx).errors, [])
})

test('Renovate has no ticket to size', () => {
  const bot = { sha: 'r1', email: RENOVATE, name: 'renovate[bot]' }
  const ctx = context({
    env: { HEAD_REF: 'renovate/all-minor' },
    routes: [[/^git log/, logOf([bot])]],
  })
  assert.deepEqual(check(ctx).errors, [])
})
