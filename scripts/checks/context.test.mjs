import assert from 'node:assert/strict'
import { test } from 'node:test'
import { branchTicket, parseAddedLines, parseLog } from './context.mjs'
import { context, failure, issueJson, logOf, RENOVATE } from './test-support.mjs'

test('reads the ticket from the branch', () => {
  assert.equal(branchTicket('feature/15-invite-by-email'), 15)
  assert.equal(branchTicket('hotfix/3-x'), 3)
  assert.equal(branchTicket('feature/invite'), null)
  assert.equal(branchTicket('feature/15-Invite'), null)
})

test('parses commits with their files', () => {
  const commits = parseLog(logOf([{ sha: 'a1', time: 5, files: ['x.ts', 'docs/y.md'] }]))
  assert.deepEqual(commits[0].files, ['x.ts', 'docs/y.md'])
  assert.equal(commits[0].time, 5)
})

test('keeps only added lines with their file and line', () => {
  const diff = [
    'diff --git a/a.ts b/a.ts',
    '--- a/a.ts',
    '+++ b/a.ts',
    '@@ -1,0 +4,2 @@',
    '+one',
    '++two',
    '-gone',
    'diff --git a/b.ts b/b.ts',
    '--- a/b.ts',
    '+++ /dev/null',
    '@@ -1 +0,0 @@',
    '-deleted',
  ].join('\n')
  assert.deepEqual(parseAddedLines(diff), [
    { file: 'a.ts', line: 4, text: 'one' },
    { file: 'a.ts', line: 5, text: '+two' },
  ])
})

test('Renovate needs its branch, every commit by its bot and the bot as PR author', () => {
  const bot = { sha: 'r1', email: RENOVATE, name: 'renovate[bot]' }
  const ctx = (ref, commits, prAuthor = 'renovate[bot]') =>
    context({
      env: { HEAD_REF: ref, PR_AUTHOR: prAuthor },
      routes: [[/^git log/, logOf(commits)]],
    })
  assert.equal(ctx('renovate/all-minor', [bot]).isRenovate(), true)
  assert.equal(ctx('renovate/all-minor', [bot, { sha: 'h1' }]).isRenovate(), false)
  assert.equal(ctx('feature/9-x', [bot]).isRenovate(), false)
  assert.equal(ctx('renovate/all-minor', [bot], 'mallory').isRenovate(), false)
  assert.equal(ctx('renovate/all-minor', [bot], null).isRenovate(), false)
})

test('an issue that does not exist is null, other gh failures throw', () => {
  const missing = context({ routes: [[/^gh api/, failure(1, 'gh: Not Found (HTTP 404)')]] })
  assert.equal(missing.issue(), null)
  const down = context({ routes: [[/^gh api/, failure(1, 'connection refused')]] })
  assert.throws(() => down.issue())
  const ok = context({ routes: [[/^gh api repos\/worKampo\/workampo\/issues\/9 /, issueJson()]] })
  assert.equal(ok.issue().state, 'open')
})

test('git grep without matches is empty', () => {
  const ctx = context({ routes: [[/^git grep/, failure(1)]] })
  assert.deepEqual(ctx.grep('@id:', ['apps']), [])
  const hit = context({ routes: [[/^git grep/, 'head:docs/domains/a.md:3:  @id:a-1-1\n']] })
  assert.deepEqual(hit.grep('@id:', ['docs/domains']), [
    { file: 'docs/domains/a.md', line: 3, text: '  @id:a-1-1' },
  ])
})
