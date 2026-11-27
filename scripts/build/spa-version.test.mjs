import assert from 'node:assert/strict'
import { execFileSync } from 'node:child_process'
import { mkdirSync, mkdtempSync, rmSync, writeFileSync } from 'node:fs'
import { tmpdir } from 'node:os'
import { dirname, join } from 'node:path'
import { after, test } from 'node:test'

const MODULE = './spa-version.mjs'
const load = () => import(MODULE)

const HASH = /^[0-9a-f]{12}$/
const ISO_UTC = /^\d{4}-\d{2}-\d{2}T\d{2}:\d{2}:\d{2}Z$/

// The web reaches domain and leaf through dependencies; tooling (a devDependency) and the API
// (a peer) are not SPA inputs.
const WORKSPACE = {
  'package.json': { name: 'root', private: true },
  'apps/web/package.json': {
    name: '@workampo/web',
    dependencies: { '@workampo/domain': 'workspace:*', react: '19.1.10' },
    devDependencies: { '@workampo/tooling': 'workspace:*' },
  },
  'apps/api/package.json': { name: '@workampo/api' },
  'packages/domain/package.json': {
    name: '@workampo/domain',
    dependencies: { '@workampo/leaf': 'workspace:*' },
    peerDependencies: { '@workampo/api': 'workspace:*' },
  },
  'packages/leaf/package.json': { name: '@workampo/leaf' },
  'packages/tooling/package.json': { name: '@workampo/tooling' },
}

const repos = []
after(() => {
  for (const dir of repos) rmSync(dir, { recursive: true, force: true })
})

// Learnings › General: a GIT_* variable from a hook would point git at the real repository.
const cleanEnv = () =>
  Object.fromEntries(Object.entries(process.env).filter(([name]) => !name.startsWith('GIT_')))

// A temporary workspace whose commits have fixed dates and an example.com identity.
function workspace() {
  const dir = mkdtempSync(join(tmpdir(), 'spa-version-'))
  repos.push(dir)
  const git = (args, date = '2026-01-01T10:00:00Z') =>
    execFileSync('git', args, {
      cwd: dir,
      encoding: 'utf8',
      env: {
        ...cleanEnv(),
        GIT_AUTHOR_NAME: 'Test',
        GIT_AUTHOR_EMAIL: 'test@example.com',
        GIT_COMMITTER_NAME: 'Test',
        GIT_COMMITTER_EMAIL: 'test@example.com',
        GIT_AUTHOR_DATE: date,
        GIT_COMMITTER_DATE: date,
      },
    })
  const write = (path, content) => {
    mkdirSync(dirname(join(dir, path)), { recursive: true })
    writeFileSync(join(dir, path), typeof content === 'string' ? content : JSON.stringify(content))
  }
  const commit = (files, date) => {
    for (const [path, content] of Object.entries(files)) write(path, content)
    git(['add', '-A'])
    git(['commit', '-q', '--no-verify', '-m', 'change'], date)
  }
  git(['init', '-q', '-b', 'master'])
  commit({ ...WORKSPACE, 'apps/web/src/main.ts': 'one' }, '2026-01-01T10:00:00Z')
  // Only git goes through run, as in deploy.mjs; the package.json files are read from root.
  const run = (command, args) => {
    assert.equal(command, 'git')
    return git(args)
  }
  const version = async () => (await load()).buildVersion({ env: {}, run, root: dir })

  return { git, commit, run, root: dir, version }
}

test('the same tree gives the same hash and date', async () => {
  const repo = workspace()

  const first = await repo.version()
  const second = await repo.version()

  assert.match(first.version, HASH)
  assert.equal(first.buildDate, '2026-01-01T10:00:00Z')
  assert.deepEqual(second, first)
})

test('a revert gives back the same hash, dated by the revert', async () => {
  const repo = workspace()
  const before = await repo.version()

  repo.commit({ 'apps/web/src/main.ts': 'two' }, '2026-01-02T10:00:00Z')
  const changed = await repo.version()
  repo.commit({ 'apps/web/src/main.ts': 'one' }, '2026-01-03T10:00:00Z')
  const reverted = await repo.version()

  assert.notEqual(changed.version, before.version)
  assert.equal(reverted.version, before.version)
  assert.equal(reverted.buildDate, '2026-01-03T10:00:00Z')
})

test('E2 a commit outside the SPA inputs changes neither the hash nor the date', async () => {
  const repo = workspace()
  const before = await repo.version()

  repo.commit({ 'apps/api/src/index.ts': 'api only' }, '2026-01-02T10:00:00Z')
  repo.commit({ 'packages/tooling/src/x.ts': 'dev dependency' }, '2026-01-03T10:00:00Z')
  repo.commit({ 'docs/x.md': 'docs' }, '2026-01-04T10:00:00Z')

  assert.deepEqual(await repo.version(), before)
})

test('a package the web reaches through dependencies is an input, transitively', async () => {
  const repo = workspace()
  const before = await repo.version()

  repo.commit({ 'packages/leaf/src/x.ts': 'leaf' }, '2026-01-02T10:00:00Z')
  const after = await repo.version()

  assert.notEqual(after.version, before.version)
  assert.equal(after.buildDate, '2026-01-02T10:00:00Z')
})

test('the date is the last commit touching the inputs, in UTC without milliseconds', async () => {
  const repo = workspace()

  repo.commit({ 'apps/web/src/main.ts': 'two' }, '2026-01-02T11:30:00+01:00')
  repo.commit({ 'apps/api/src/index.ts': 'later, api only' }, '2026-01-05T10:00:00Z')
  const { buildDate } = await repo.version()

  assert.equal(buildDate, '2026-01-02T10:30:00Z')
  assert.match(buildDate, ISO_UTC)
})

test('R8 values given in the environment are used as they are, without git', async () => {
  const { buildVersion } = await load()
  const env = { VITE_APP_VERSION: '9f8e7d6c5b4a', VITE_APP_BUILD_DATE: '2026-01-01T00:00:00Z' }
  const run = () => assert.fail('git must not run')

  assert.deepEqual(buildVersion({ env, run }), {
    version: '9f8e7d6c5b4a',
    buildDate: '2026-01-01T00:00:00Z',
  })
})

test('R8 an invalid version or date in the environment throws', async () => {
  const { buildVersion } = await load()
  const run = () => assert.fail('git must not run')
  const valid = { VITE_APP_VERSION: '9f8e7d6c5b4a', VITE_APP_BUILD_DATE: '2026-01-01T00:00:00Z' }

  for (const env of [
    { ...valid, VITE_APP_VERSION: 'dev' },
    { ...valid, VITE_APP_VERSION: '9F8E7D6C5B4A' },
    { ...valid, VITE_APP_VERSION: '9f8e7d6c5b4a0' },
    { ...valid, VITE_APP_BUILD_DATE: 'tomorrow' },
    { ...valid, VITE_APP_BUILD_DATE: '2026-01-01T00:00:00.000Z' },
    { ...valid, VITE_APP_BUILD_DATE: '2026-13-40T00:00:00Z' },
  ])
    assert.throws(() => buildVersion({ env, run }), undefined, JSON.stringify(env))
})

test('R8 a failing or silent git throws instead of building as dev', async () => {
  const repo = workspace()
  const { buildVersion } = await load()
  const failing = () => {
    throw new Error('fatal: not a git repository')
  }

  assert.throws(() => buildVersion({ env: {}, run: failing, root: repo.root }), /not a git/)
  assert.throws(() => buildVersion({ env: {}, run: () => '', root: repo.root }))
})
