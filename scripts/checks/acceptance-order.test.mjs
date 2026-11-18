import assert from 'node:assert/strict'
import { test } from 'node:test'
import { acceptanceErrors, check, isReopenCandidate } from './acceptance-order.mjs'
import { context, failure, issueJson, logOf } from './test-support.mjs'

const SCENARIO = 'apps/web/e2e/acceptance/invite.spec.ts'
const commit = (sha, files, reopens = []) => ({ sha, files, reopens })
const none = () => false

test('passes when scenarios come first, after docs and .work/ only', () => {
  const commits = [
    commit('d1', ['docs/domains/companies.md', '.work/tasks.md']),
    commit('a1', [SCENARIO]),
    commit('c1', ['apps/web/src/x.tsx']),
  ]
  assert.deepEqual(acceptanceErrors(commits, none), [])
})

test('fails when a scenario changes after code, saying how to reopen', () => {
  const commits = [commit('c1aaaaaaa', ['apps/web/src/x.tsx']), commit('a1aaaaaaa', [SCENARIO])]
  const [error] = acceptanceErrors(commits, none)
  assert.match(error, /a1aaaaa touches e2e\/acceptance\/ after c1aaaaa/)
  assert.match(error, /Reopen: <comment-id>/)
})

test('a mixed commit before any code fails and counts as code', () => {
  const commits = [commit('m1', [SCENARIO, 'apps/web/src/x.tsx']), commit('a2', [SCENARIO])]
  const errors = acceptanceErrors(commits, none)
  assert.equal(errors.length, 2)
  assert.match(errors[0], /^m1 mixes e2e\/acceptance\/ with other paths/)
  assert.match(errors[1], /^a2 touches e2e\/acceptance\/ after m1/)
})

test('a late scenario commit needs a trusted Reopen id, each id usable once', () => {
  const trusted = (id) => id === '42'
  const late = (reopens) => [
    commit('a1', [SCENARIO]),
    commit('c1', ['apps/web/src/x.tsx']),
    commit('a2', [SCENARIO], reopens),
  ]
  assert.deepEqual(acceptanceErrors(late(['42']), trusted), [])
  assert.equal(acceptanceErrors(late(['7']), trusted).length, 1)
  assert.equal(acceptanceErrors(late([]), trusted).length, 1)
  const reused = [...late(['42']), commit('a3', [SCENARIO], ['42'])]
  assert.match(acceptanceErrors(reused, trusted)[0], /^a3 /)
})

test('only a plain user comment starting with /reopen-acceptance is a candidate', () => {
  const ok = { body: '/reopen-acceptance\nscenario 2 was wrong', user: { type: 'User' } }
  assert.equal(isReopenCandidate(ok), true)
  assert.equal(isReopenCandidate({ ...ok, body: 'please /reopen-acceptance' }), false)
  assert.equal(isReopenCandidate({ ...ok, user: { type: 'Bot' } }), false)
  assert.equal(
    isReopenCandidate({ ...ok, performed_via_github_app: { slug: 'workampo-agents' } }),
    false,
  )
})

function ctxWith(comments, permissions, reopens = ['100']) {
  const commits = [
    commit('a1', [SCENARIO]),
    commit('c1', ['apps/web/src/x.tsx']),
    commit('a2', [SCENARIO], reopens),
  ]
  return context({
    routes: [
      [/^git log/, logOf(commits)],
      [/^gh api .*issues\/9 /, issueJson()],
      [
        /^gh api --paginate .*issues\/9\/comments/,
        comments.map((c) => JSON.stringify(c)).join('\n'),
      ],
      ...Object.entries(permissions).map(([login, answer]) => [
        new RegExp(`collaborators/${login}/permission`),
        answer,
      ]),
    ],
  })
}

const reopen = (login, extra = {}) => ({
  id: 100,
  body: '/reopen-acceptance',
  user: { login, type: 'User' },
  performed_via_github_app: null,
  ...extra,
})

test('a Reopen trailer naming an admin reopen comment passes through gh', () => {
  assert.deepEqual(check(ctxWith([reopen('owner')], { owner: 'admin\n' })).errors, [])
})

test('a reopen by a non-admin, an app or a bot, or an unknown id does not count', () => {
  const cases = [
    ctxWith([reopen('writer')], { writer: 'write\n' }),
    ctxWith([reopen('stranger')], { stranger: failure(1, 'HTTP 404') }),
    ctxWith([reopen('owner', { performed_via_github_app: { id: 1 } })], { owner: 'admin\n' }),
    ctxWith([reopen('bot', { user: { login: 'bot', type: 'Bot' } })], { bot: 'admin\n' }),
    ctxWith([reopen('owner', { body: 'looks fine' })], { owner: 'admin\n' }),
    ctxWith([reopen('owner')], { owner: 'admin\n' }, ['101']),
  ]
  for (const ctx of cases) assert.equal(check(ctx).errors.length, 1)
})

test('does not call gh when no commit touches e2e/acceptance/', () => {
  const calls = []
  const ctx = context({
    calls,
    routes: [[/^git log/, logOf([{ sha: 'c1', files: ['apps/api/src/x.ts'] }])]],
  })
  assert.deepEqual(check(ctx).errors, [])
  assert.equal(calls.filter((call) => call.startsWith('gh')).length, 0)
})
