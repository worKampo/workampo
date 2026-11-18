import assert from 'node:assert/strict'
import { execFileSync } from 'node:child_process'
import { mkdtempSync, rmSync, writeFileSync } from 'node:fs'
import { tmpdir } from 'node:os'
import { join } from 'node:path'
import { test } from 'node:test'
import {
  branchTicket,
  createContext,
  defaultRun,
  parseAddedLines,
  parseLog,
  parseNameStatus,
} from './context.mjs'
import { context, failure, issueJson, logOf, RENOVATE } from './test-support.mjs'

test('reads the ticket from the branch', () => {
  assert.equal(branchTicket('feature/15-invite-by-email'), 15)
  assert.equal(branchTicket('hotfix/3-x'), 3)
  assert.equal(branchTicket('feature/invite'), null)
  assert.equal(branchTicket('feature/15-Invite'), null)
})

test('parses commits with their files and Reopen trailers', () => {
  const commits = parseLog(
    logOf([{ sha: 'a1', reopens: ['7', '8'], files: ['x.ts', 'docs/y.md'] }]),
  )
  assert.deepEqual(commits[0].files, ['x.ts', 'docs/y.md'])
  assert.deepEqual(commits[0].reopens, ['7', '8'])
  assert.deepEqual(parseLog(logOf([{ sha: 'a2' }]))[0].reopens, [])
})

test('reads name-status -z with renames, deletions and odd names', () => {
  const text = 'M\0a.ts\0R087\0old/x.ts\0new/x.ts\0D\0gone.ts\0A\0dir/"q"\ttab.ts\0'
  assert.deepEqual(parseNameStatus(text), [
    { status: 'M', paths: ['a.ts'] },
    { status: 'R', paths: ['old/x.ts', 'new/x.ts'] },
    { status: 'D', paths: ['gone.ts'] },
    { status: 'A', paths: ['dir/"q"\ttab.ts'] },
  ])
})

test('keeps only added lines with their line, across hunks', () => {
  const diff = [
    'diff --git a/a.ts b/a.ts',
    '--- a/a.ts',
    '+++ b/a.ts',
    '@@ -0,0 +4,2 @@',
    '+one',
    '++two',
    '@@ -9 +11 @@',
    '-gone',
    '\\ No newline at end of file',
    '+three',
  ].join('\n')
  assert.deepEqual(parseAddedLines(diff, 'a.ts'), [
    { file: 'a.ts', line: 4, text: 'one' },
    { file: 'a.ts', line: 5, text: '+two' },
    { file: 'a.ts', line: 11, text: 'three' },
  ])
})

test('added lines that look like file headers stay content of the real file', () => {
  const diff = [
    'diff --git a/a.ts b/a.ts',
    '--- a/a.ts',
    '+++ b/a.ts',
    '@@ -1,2 +1,4 @@',
    '--- a/README.md',
    '+++ b/README.md',
    '-- x',
    '++++ b/x',
    '+++ /dev/null',
    '+plain',
  ].join('\n')
  assert.deepEqual(
    parseAddedLines(diff, 'a.ts').map(({ file, text }) => [file, text]),
    [
      ['a.ts', '++ b/README.md'],
      ['a.ts', '+++ b/x'],
      ['a.ts', '++ /dev/null'],
      ['a.ts', 'plain'],
    ],
  )
  assert.throws(() => parseAddedLines('@@ -1 +1,2 @@\n+only one', 'a.ts'), /truncated/)
})

test('binary files add no lines', () => {
  const diff =
    'diff --git a/i.png b/i.png\nindex 1..2 100644\nBinary files a/i.png and b/i.png differ\n'
  assert.deepEqual(parseAddedLines(diff, 'i.png'), [])
})

test('added lines come from one diff per file named by the -z listing', () => {
  const calls = []
  const ctx = context({
    calls,
    routes: [
      [/^git diff --name-status -z/, 'M\0a.ts\0R090\0old.ts\0new.ts\0D\0gone.ts\0'],
      [/^git diff -U0 .* -- :\(literal\)a\.ts$/, '@@ -1 +1 @@\n-x\n+++ b/README.md\n'],
      [/^git diff -U0 .* -- :\(literal\)old\.ts :\(literal\)new\.ts$/, '@@ -0,0 +3 @@\n+y\n'],
    ],
  })
  assert.deepEqual(ctx.addedLines(), [
    { file: 'a.ts', line: 1, text: '++ b/README.md' },
    { file: 'new.ts', line: 3, text: 'y' },
  ])
  assert.deepEqual(ctx.changedFiles(), ['a.ts', 'old.ts', 'new.ts', 'gone.ts'])
  assert.equal(calls.filter((call) => call.includes('gone.ts') && call.includes('-U0')).length, 0)
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

test('a merge lists the files its resolution changed, not those the merged branch brought', () => {
  const dir = mkdtempSync(join(tmpdir(), 'merge-files-'))
  const git = (...args) =>
    execFileSync(
      'git',
      [
        '-c',
        `core.hooksPath=${join(dir, 'no-hooks')}`,
        '-c',
        'user.name=t',
        '-c',
        'user.email=t@example.com',
        ...args,
      ],
      { cwd: dir, encoding: 'utf8', stdio: ['ignore', 'pipe', 'pipe'] },
    ).trim()
  const write = (file, text) => writeFileSync(join(dir, file), text)
  const commit = (message) => git('commit', '-q', '-a', '-m', message)
  try {
    git('init', '-q', '-b', 'master')
    write('a.ts', '1')
    write('spec.ts', 's')
    git('add', '.')
    commit('chore: base')
    const base = git('rev-parse', 'HEAD')
    git('switch', '-q', '-c', 'branch')
    write('a.ts', '2')
    commit('feat: branch')
    git('switch', '-q', 'master')
    write('a.ts', '3')
    write('m.ts', 'm')
    git('add', '.')
    commit('feat: master')
    git('switch', '-q', 'branch')
    assert.throws(() => git('merge', '-q', 'master'))
    write('a.ts', '4')
    write('spec.ts', 'changed in the resolution')
    git('add', '.')
    commit('chore: merge master')
    const ctx = createContext({
      env: { BASE_SHA: base, HEAD_SHA: git('rev-parse', 'HEAD') },
      run: (file, args) => defaultRun(file, args, { cwd: dir }),
    })
    assert.deepEqual(ctx.commits().at(-1).files.toSorted(), ['a.ts', 'spec.ts'])
  } finally {
    rmSync(dir, { recursive: true, force: true })
  }
})
