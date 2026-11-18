import assert from 'node:assert/strict'
import { test } from 'node:test'
import { acceptanceErrors, check, isReopenCandidate } from './acceptance-order.mjs'
import { context, failure, issueJson, logOf } from './test-support.mjs'

const SCENARIO = 'apps/web/e2e/acceptance/invite.spec.ts'
const at = (iso) => Date.parse(iso) / 1000

test('passes when scenarios come first, after docs and .work/ only', () => {
  const commits = [
    { sha: 'd1', time: 1, files: ['docs/domains/companies.md', '.work/tasks.md'] },
    { sha: 'a1', time: 2, files: [SCENARIO] },
    { sha: 'c1', time: 3, files: ['apps/web/src/x.tsx'] },
  ]
  assert.deepEqual(acceptanceErrors(commits, []), [])
})

test('fails when a scenario changes after code', () => {
  const commits = [
    { sha: 'c1aaaaaaa', time: 1, files: ['apps/web/src/x.tsx'] },
    { sha: 'a1aaaaaaa', time: 2, files: [SCENARIO] },
  ]
  assert.match(acceptanceErrors(commits, [])[0], /a1aaaaa touches e2e\/acceptance\/ after c1aaaaa/)
})

test('a reopen before the commit starts a new segment', () => {
  const commits = [
    { sha: 'a1', time: 1, files: [SCENARIO] },
    { sha: 'c1', time: 2, files: ['apps/web/src/x.tsx'] },
    { sha: 'a2', time: 4, files: [SCENARIO] },
    { sha: 'c2', time: 5, files: ['apps/web/src/y.tsx'] },
  ]
  assert.deepEqual(acceptanceErrors(commits, [3]), [])
  assert.equal(acceptanceErrors(commits, [4.5]).length, 1)
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

function ctxWith(comments, permissions) {
  const commits = [
    { sha: 'a1', time: at('2026-11-18T10:00:00Z'), files: [SCENARIO] },
    { sha: 'c1', time: at('2026-11-18T11:00:00Z'), files: ['apps/web/src/x.tsx'] },
    { sha: 'a2', time: at('2026-11-18T13:00:00Z'), files: [SCENARIO] },
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
  body: '/reopen-acceptance',
  user: { login, type: 'User' },
  performed_via_github_app: null,
  created_at: '2026-11-18T12:00:00Z',
  ...extra,
})

test('an admin reopen between the commits passes through gh', () => {
  assert.deepEqual(check(ctxWith([reopen('owner')], { owner: 'admin\n' })).errors, [])
})

test('a reopen by a non-admin, an app or a bot does not count', () => {
  const cases = [
    ctxWith([reopen('writer')], { writer: 'write\n' }),
    ctxWith([reopen('stranger')], { stranger: failure(1, 'HTTP 404') }),
    ctxWith([reopen('owner', { performed_via_github_app: { id: 1 } })], { owner: 'admin\n' }),
    ctxWith([reopen('renovate[bot]', { user: { login: 'bot', type: 'Bot' } })], {
      bot: 'admin\n',
    }),
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
