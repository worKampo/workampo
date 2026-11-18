import assert from 'node:assert/strict'
import { test } from 'node:test'
import {
  activeTickets,
  boardField,
  buildInbox,
  checkIdentity,
  ciSummary,
  help,
  nextStep,
  parseArgs,
  parseIssueNumber,
  resume,
  statusLine,
  taskCounts,
  ticketFromBranch,
} from './work.mjs'

const CONFIG = {
  github: {
    organization: 'worKampo',
    repository: 'worKampo/workampo',
    board: 'https://github.com/orgs/worKampo/projects/1',
    account: 'workampo-dev',
    commitEmail: '1+workampo-dev@users.noreply.github.com',
  },
}

const PROGRESS = `# Progress

PRD #4 · Ticket #9 automation · Branch: feature/9-automation
Step: Build › Implement · wave 1 of 4
Done in this step: T1
In progress: T3
Next: wave 2 (T2, T5)
Waiting for human: —
Open questions: —
Updated: 2026-11-18`

const ISSUES = [
  {
    number: 9,
    title: 'Process automation',
    url: 'https://github.com/worKampo/workampo/issues/9',
    labels: [{ name: 'size:L' }, { name: 'type:chore' }],
    body: '- [x] T1\n- [ ] T2\n- [X] T3',
    comments: [],
  },
  {
    number: 12,
    title: 'Invite by email',
    url: 'https://github.com/worKampo/workampo/issues/12',
    labels: [{ name: 'size:M' }],
    body: '',
    comments: [],
  },
  {
    number: 4,
    title: '[PRD] Team Working foundation',
    url: 'https://github.com/worKampo/workampo/issues/4',
    labels: [],
    body: '',
    comments: [
      { body: '# Progress\nWaiting for human: approve the slicing' },
      { body: 'unrelated' },
    ],
  },
]

const PRS = [
  {
    number: 40,
    title: 'feat: invite by email',
    url: 'https://github.com/worKampo/workampo/pull/40',
    headRefName: 'feature/12-invite-by-email',
    isDraft: false,
    reviews: [{ author: { login: 'workampo-dev' }, state: 'APPROVED' }],
    comments: [{ body: '## Progress\nStep: Review\nNext: person verifies\nWaiting for human: —' }],
    statusCheckRollup: [{ status: 'COMPLETED', conclusion: 'SUCCESS' }],
  },
  {
    number: 41,
    title: 'chore(deps): update biome',
    url: 'https://github.com/worKampo/workampo/pull/41',
    headRefName: 'renovate/biome',
    isDraft: false,
    reviews: [],
    comments: [],
    statusCheckRollup: [],
  },
]

const BOARD = [
  {
    status: 'Build',
    'espera a': 'Agente',
    content: { type: 'Issue', number: 9, repository: 'worKampo/workampo' },
  },
  { status: 'Ready', content: { type: 'Issue', number: 4, repository: 'worKampo/workampo' } },
  {
    status: 'Review',
    'espera a': 'Persona',
    content: { type: 'Issue', number: 12, repository: 'worKampo/workampo' },
  },
]

function data({ board = BOARD } = {}) {
  return {
    repository: 'worKampo/workampo',
    issues: ISSUES,
    prs: PRS,
    board,
    branches: new Map([[9, { branch: 'feature/9-automation', progress: PROGRESS }]]),
  }
}

const slashes = (path) => path.replaceAll('\\', '/')

function fakeIo(responses, { env = {}, files = {} } = {}) {
  const calls = []
  const output = []
  const io = {
    env,
    calls,
    output,
    isInteractive: false,
    log: (text) => output.push(text),
    warn: () => {},
    exists: (path) => Object.keys(files).some((name) => slashes(path).endsWith(name)),
    readFile: (path) => files[Object.keys(files).find((name) => slashes(path).endsWith(name))],
    run: (command, args) => {
      calls.push([command, ...args])
      const key = [command, ...args].join(' ')
      const match = Object.keys(responses).find((prefix) => key.startsWith(prefix))
      if (match === undefined) throw new Error(`unexpected ${key}`)
      const value = responses[match]
      if (value instanceof Error) throw value
      return typeof value === 'string' ? value : JSON.stringify(value)
    },
  }
  return io
}

test('issue numbers take 15 and #15', () => {
  assert.equal(parseIssueNumber('15'), 15)
  assert.equal(parseIssueNumber('#15'), 15)
  for (const bad of ['', '#', '0', '15a', '-3', '##15', '1.5'])
    assert.throws(() => parseIssueNumber(bad), /15 or #15/, bad)
})

test('parses commands, numbers and flags', () => {
  assert.equal(parseArgs([]).command, 'help')
  assert.equal(parseArgs(['--help']).command, 'help')
  assert.deepEqual(parseArgs(['status', '#9', '12', '--json']), {
    command: 'status',
    numbers: [9, 12],
    json: true,
    dryRun: false,
  })
  assert.equal(parseArgs(['resume', '--dry-run']).dryRun, true)
  assert.throws(() => parseArgs(['deploy']), /Unknown command/)
  assert.throws(() => parseArgs(['status', '--force']), /Unknown option/)
  assert.throws(() => parseArgs(['resume', '1', '2']), /at most one/)
  assert.throws(() => parseArgs(['inbox', '3']), /no issue numbers/)
})

test('a ticket branch gives its number', () => {
  assert.equal(ticketFromBranch('feature/15-invite-by-email'), 15)
  assert.equal(ticketFromBranch('bugfix/7-x'), 7)
  assert.equal(ticketFromBranch('hotfix/101-y'), 101)
  for (const branch of ['master', 'renovate/biome', 'feature/no-number', 'feat/15-x', undefined])
    assert.equal(ticketFromBranch(branch), null, branch)
})

test('identity: right email and project account pass', () => {
  const io = fakeIo({
    'git config user.email': `${CONFIG.github.commitEmail}\n`,
    'gh api user': 'workampo-dev\n',
  })
  assert.deepEqual(checkIdentity(CONFIG, io), [])
})

test('identity: wrong email refuses with the fix', () => {
  const io = fakeIo({
    'git config user.email': 'someone@example.com\n',
    'gh api user': 'workampo-dev\n',
  })
  const [problem, ...rest] = checkIdentity(CONFIG, io)
  assert.equal(rest.length, 0)
  assert.match(problem, /git config user\.email "1\+workampo-dev@users\.noreply\.github\.com"/)
})

test('identity: another gh account refuses with the fix', () => {
  for (const login of ['other-user\n', new Error('not logged in')]) {
    const io = fakeIo({
      'git config user.email': CONFIG.github.commitEmail,
      'gh api user': login,
    })
    const problems = checkIdentity(CONFIG, io)
    assert.equal(problems.length, 1)
    assert.match(problems[0], /gh auth switch --user workampo-dev/)
  }
})

test('identity: GH_TOKEN must be an installation token of this repo, never the gh login', () => {
  const ok = fakeIo(
    {
      'git config user.email': CONFIG.github.commitEmail,
      'gh api /installation/repositories': '["worKampo/workampo"]',
    },
    { env: { GH_TOKEN: 'x' } },
  )
  assert.deepEqual(checkIdentity(CONFIG, ok), [])
  assert.ok(!ok.calls.some((call) => call.join(' ') === 'gh api user --jq .login'))

  for (const answer of [new Error('HTTP 403'), '["someone/else"]']) {
    const io = fakeIo(
      {
        'git config user.email': CONFIG.github.commitEmail,
        'gh api /installation/repositories': answer,
      },
      { env: { GH_TOKEN: 'x' } },
    )
    const problems = checkIdentity(CONFIG, io)
    assert.equal(problems.length, 1)
    assert.match(problems[0], /app-token\.mjs/)
    assert.ok(!problems[0].includes('GH_TOKEN=x'))
  }
})

test('help shows the next step from .work/PROGRESS.md or the PR "Progress" comment', () => {
  assert.equal(nextStep(PROGRESS), 'wave 2 (T2, T5)')
  assert.equal(nextStep('# Progress\nStep: x'), null)

  const local = fakeIo(
    { 'git branch --show-current': 'feature/9-automation\n' },
    { files: { '.work/PROGRESS.md': PROGRESS } },
  )
  help(local)
  assert.match(local.output[0], /Ticket #9 · next: wave 2 \(T2, T5\)/)

  const fromPr = fakeIo({
    'git branch --show-current': 'feature/12-invite-by-email\n',
    'gh pr view feature/12-invite-by-email': { comments: PRS[0].comments },
  })
  help(fromPr)
  assert.match(fromPr.output[0], /Ticket #12 · next: person verifies/)

  const master = fakeIo({ 'git branch --show-current': 'master\n' })
  help(master)
  assert.doesNotMatch(master.output[0], /Ticket #/)
})

test('status: one line per ticket in Define, Build or Review', () => {
  const lines = activeTickets(data()).map(statusLine)
  assert.deepEqual(lines, [
    '#9 L · Process automation · Build › Implement · wave 1 of 4 · tasks 2/3 · next: wave 2 (T2, T5)',
    '#12 M · Invite by email · Review · tasks 0/0 · next: person verifies',
  ])
})

test('status without the board falls back to PRs and ticket branches', () => {
  assert.deepEqual(
    activeTickets(data({ board: null })).map((t) => [t.number, t.column]),
    [
      [9, null],
      [12, null],
    ],
  )
})

test('inbox: unapproved PRs, waiting deployments, "Persona" and "Waiting for human"', () => {
  const runs = [{ name: 'Deploy', head_sha: 'abcdef1234', html_url: 'https://github.com/r/1' }]
  const items = buildInbox(data(), runs, 'workampo-dev')
  assert.deepEqual(
    items.map((item) => item.text),
    [
      'PR #41 to review: chore(deps): update biome',
      'Deployment waiting for approval: Deploy abcdef1',
      '#12 Invite by email: Espera a: Persona',
      '#4 [PRD] Team Working foundation: approve the slicing',
    ],
  )
  assert.ok(items.every((item) => item.url.startsWith('https://')))
})

test('board fields and CI summary', () => {
  assert.equal(boardField({ 'Espera a': 'Persona' }, 'Espera a'), 'Persona')
  assert.equal(boardField({ esperaA: 'Persona' }, 'Espera a'), 'Persona')
  assert.deepEqual(taskCounts('- [x] a\n  * [ ] b\ntext [ ]'), { done: 1, total: 2 })
  assert.equal(ciSummary([]), 'no checks')
  assert.equal(ciSummary([{ status: 'COMPLETED', conclusion: 'FAILURE' }]), 'failing')
  assert.equal(ciSummary([{ status: 'IN_PROGRESS', conclusion: '' }]), 'pending')
  assert.equal(
    ciSummary([{ state: 'SUCCESS' }, { status: 'COMPLETED', conclusion: 'SKIPPED' }]),
    'passing',
  )
})

test('resume refuses with uncommitted changes and lists tickets when not interactive', async () => {
  const dirty = fakeIo({ 'git status --porcelain': ' M a.mjs\n' })
  await assert.rejects(resume({ numbers: [], dryRun: false }, CONFIG, dirty), /uncommitted/)

  const io = fakeIo({
    'git status --porcelain': '',
    'gh issue list': ISSUES,
    'gh pr list': PRS,
    'gh project item-list': { items: BOARD },
    'git for-each-ref': 'feature/9-automation\n',
    'git show feature/9-automation:.work/PROGRESS.md': PROGRESS,
  })
  await resume({ numbers: [], dryRun: false }, CONFIG, io)
  assert.match(io.output.join('\n'), /#9 L[\s\S]*#12 M[\s\S]*pnpm work resume <n>/)
  assert.ok(!io.calls.some((call) => call[1] === 'switch'))
})

test('resume --dry-run prints the switch and the reading order without switching', async () => {
  const io = fakeIo({
    'git status --porcelain': '',
    'gh issue list': ISSUES,
    'gh pr list': PRS,
    'gh project item-list': new Error('missing project scope'),
    'git for-each-ref': 'feature/9-automation\n',
    'git show feature/9-automation:.work/PROGRESS.md': PROGRESS,
    'git branch --show-current': 'master\n',
    'git cat-file -e feature/9-automation:.work/tasks.md': '',
    'git cat-file': new Error('missing'),
  })
  await resume({ numbers: [9], dryRun: true }, CONFIG, io)
  const out = io.output.join('\n')
  assert.match(out, /Would run: git switch feature\/9-automation/)
  assert.match(out, /1\. AGENTS\.md\n2\. \.work\/PROGRESS\.md:\n {3}# Progress/)
  assert.match(out, /4\. \.work\/tasks\.md\n/)
  assert.match(out, /Continue from Next: wave 2/)
  assert.ok(!io.calls.some((call) => call[1] === 'switch'))
})
