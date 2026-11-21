import assert from 'node:assert/strict'
import { test } from 'node:test'
import { check } from './pr-body.mjs'
import { context, failure, issueJson, logOf, RENOVATE } from './test-support.mjs'

const routes = (parent) => [
  [/^git log/, logOf([{ sha: 'h1' }])],
  [/^gh api .*issues\/9\/parent/, parent],
  [/^gh api .*issues\/9 /, issueJson()],
]
const labels = 'type:chore,area:platform'

test('passes with Ticket, PRD of the parent and both labels', () => {
  const ctx = context({
    env: { PR_BODY: 'PRD #4 · Ticket #9', PR_LABELS: labels },
    routes: routes('4\n'),
  })
  assert.deepEqual(check(ctx).errors, [])
})

test('a ticket without parent needs no PRD', () => {
  const ctx = context({
    env: { PR_BODY: 'Ticket #9', PR_LABELS: labels },
    routes: routes(failure(1, 'HTTP 404')),
  })
  assert.deepEqual(check(ctx).errors, [])
})

test('fails without the ticket, the PRD or a label', () => {
  const ctx = context({
    env: { PR_BODY: 'Ticket #90', PR_LABELS: 'type:chore' },
    routes: routes('4\n'),
  })
  assert.deepEqual(check(ctx).errors, [
    'the body needs "Ticket #9"',
    'the body needs "PRD #4" (parent of #9)',
    'the PR needs a area: label',
  ])
})

test('Renovate only needs the labels', () => {
  const bot = { sha: 'r1', email: RENOVATE, name: 'renovate[bot]' }
  const ctx = (PR_LABELS) =>
    context({
      env: { HEAD_REF: 'renovate/all-minor', PR_BODY: '', PR_LABELS },
      routes: [[/^git log/, logOf([bot])]],
    })
  assert.deepEqual(check(ctx(labels)).errors, [])
  assert.equal(check(ctx('')).errors.length, 2)
})

test('fails when the body closes an issue with a closing keyword', () => {
  const ctx = context({
    env: { PR_BODY: 'Ticket #9\n- [ ] After the merge the stg run closes #9', PR_LABELS: labels },
    routes: routes(failure(1, 'HTTP 404')),
  })
  assert.deepEqual(check(ctx).errors, [
    'the body closes #9 with a closing keyword: GitHub would close it at the merge; write "ticket N" instead',
  ])
})
