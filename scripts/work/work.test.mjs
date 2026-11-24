import assert from 'node:assert/strict'
import { join } from 'node:path'
import { test } from 'node:test'
import {
  activeTickets,
  boardField,
  boardFix,
  buildInbox,
  checkIdentity,
  ciSummary,
  close,
  closeComment,
  ghCommand,
  help,
  latestProgress,
  moveCard,
  nextStep,
  openCommand,
  parseArgs,
  parseIssueNumber,
  personGhConfigDir,
  pr,
  prBody,
  progressComment,
  progressText,
  prTitle,
  pushEnv,
  resume,
  slugify,
  start,
  statusLine,
  stopHint,
  tagIssue,
  taskCounts,
  ticketFromBranch,
  trustedAuthors,
  usePersonGh,
  verificationList,
  verify,
  withLoginHint,
  withoutCredentials,
} from './work.mjs'

const CONFIG = {
  github: {
    organization: 'worKampo',
    repository: 'worKampo/workampo',
    board: 'https://github.com/orgs/worKampo/projects/1',
    account: 'workampo-dev',
    commitEmail: '1+workampo-dev@users.noreply.github.com',
    agentsApp: { name: 'workampo-agents' },
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
      {
        user: { login: 'workampo-agents[bot]', type: 'Bot' },
        body: '# Progress\nWaiting for human: approve the slicing',
      },
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
    comments: [
      {
        user: { login: 'workampo-dev', type: 'User' },
        body: '## Progress\nStep: Review\nNext: person verifies\nWaiting for human: —',
      },
    ],
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
    authors: trustedAuthors(CONFIG),
    issues: ISSUES,
    prs: PRS,
    board,
    branches: new Map([[9, { branch: 'feature/9-automation', progress: PROGRESS }]]),
  }
}

// Serves `gh api repos/<repo>/issues/<n>/comments --paginate --jq .[]` for items that carry `comments`.
const COMMENTS = 'gh api repos/worKampo/workampo/issues/'
const commentsOf = (items) => (args) =>
  (items.find((item) => args[1].includes(`/issues/${item.number}/`))?.comments ?? [])
    .map((comment) => JSON.stringify(comment))
    .join('\n')

const slashes = (path) => path.replaceAll('\\', '/')

function fakeIo(responses, { env = {}, files = {} } = {}) {
  const calls = []
  const inputs = []
  const envs = []
  const output = []
  const warnings = []
  const writes = {}
  const io = {
    env,
    calls,
    inputs,
    envs,
    output,
    warnings,
    writes,
    isInteractive: false,
    log: (text) => output.push(text),
    warn: (text) => warnings.push(text),
    now: () => new Date('2026-11-18T10:42:00Z'),
    exists: (path) => Object.keys(files).some((name) => slashes(path).endsWith(name)),
    readFile: (path) => {
      const name = Object.keys(files).find((file) => slashes(path).endsWith(file))
      if (name === undefined) throw Object.assign(new Error(`ENOENT: ${path}`), { code: 'ENOENT' })
      return files[name]
    },
    writeFile: (path, text) => {
      writes[slashes(path)] = text
    },
    // Recursive, like readdirSync with { recursive: true }: names relative to dir.
    list: (dir) =>
      Object.keys(files).flatMap((name) => {
        const parts = name.split('/')
        for (let i = parts.length - 1; i > 0; i--)
          if (slashes(dir).endsWith(parts.slice(0, i).join('/'))) return [parts.slice(i).join('/')]
        return []
      }),
    run: (command, args, options) => {
      calls.push([command, ...args])
      if (options?.input) inputs.push(options.input)
      if (options?.env) envs.push(options.env)
      const key = [command, ...args].join(' ')
      const match = Object.keys(responses)
        .filter((prefix) => key.startsWith(prefix))
        .sort((a, b) => b.length - a.length)[0]
      if (match === undefined) throw new Error(`unexpected ${key}`)
      let value = responses[match]
      if (typeof value === 'function') value = value(args)
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

test('identity: another gh account refuses with the login in the project gh config, never auth switch', () => {
  for (const login of ['other-user\n', new Error('not logged in')]) {
    const io = fakeIo(
      {
        'git config user.email': CONFIG.github.commitEmail,
        'gh api user': login,
      },
      { env: { GH_CONFIG_DIR: '/home/p/.workampo/gh' } },
    )
    const problems = checkIdentity(CONFIG, io)
    assert.equal(problems.length, 1)
    assert.match(
      problems[0],
      /GH_CONFIG_DIR='\/home\/p\/\.workampo\/gh' gh auth login -h github\.com -s project/,
    )
    assert.ok(!problems[0].includes('auth switch'))
  }
})

test('a gh error without a login in the project config adds the login command', () => {
  const env = { GH_CONFIG_DIR: '/home/p/.workampo/gh' }
  const raw = 'gh issue failed: To get started with GitHub CLI, please run:  gh auth login'
  assert.match(
    withLoginHint(raw, env),
    /GH_CONFIG_DIR='\/home\/p\/\.workampo\/gh' gh auth login -h github\.com -s project/,
  )
  assert.equal(withLoginHint('gh pr failed: HTTP 404', env), 'gh pr failed: HTTP 404')
  assert.equal(withLoginHint(raw, { GH_TOKEN: 'x' }), raw)
})

test('gh commands set the config dir for Git Bash and, in one cmd process, for PowerShell', () => {
  const command = ghCommand("C:\\Users\\A B\\it's\\gh", 'auth login')
  assert.ok(command.includes("GH_CONFIG_DIR='C:\\Users\\A B\\it'\\''s\\gh' gh auth login"))
  assert.ok(
    command.includes('cmd /c "set GH_CONFIG_DIR=C:\\Users\\A B\\it\'s\\gh&& gh auth login"'),
  )
  assert.ok(!command.includes('$env:'))
})

test('the board hint names the project gh config for the person and the App permission for agents', () => {
  assert.match(
    boardFix({ GH_CONFIG_DIR: '/p/gh' }),
    /GH_CONFIG_DIR='\/p\/gh' gh auth refresh -s project/,
  )
  assert.match(boardFix({ GH_TOKEN: 'x' }), /App .*Projects.*Read and write/)
  assert.match(boardFix({ GH_TOKEN: 'x', GITHUB_ACTIONS: 'true' }), /no BOARD_TOKEN.*ADR-0069/)
  assert.match(boardFix({ GH_TOKEN: 'x', BOARD_TOKEN: 'b' }), /board App .*Projects/)
})

test('moveCard uses BOARD_TOKEN for every board call when the job has one', () => {
  const url = 'https://github.com/worKampo/workampo/issues/15'
  const env = { GH_TOKEN: 'workflow-token', BOARD_TOKEN: 'board-token' }
  const io = fakeIo(BOARD_API, { env })
  moveCard(url, 'Done', {}, CONFIG, io)
  assert.equal(io.calls.length, 4)
  assert.equal(io.envs.length, 4)
  assert.ok(io.envs.every((e) => e.GH_TOKEN === 'board-token'))
  assert.deepEqual(io.warnings, [])

  const without = fakeIo(BOARD_API, { env: { GH_TOKEN: 'workflow-token' } })
  moveCard(url, 'Done', {}, CONFIG, without)
  assert.deepEqual(without.envs, [])

  const denied = fakeIo({ ...BOARD_API, 'gh project view': new Error('HTTP 403') }, { env })
  moveCard(url, 'Done', {}, CONFIG, denied)
  assert.match(denied.warnings[0], /board App .*Set the card to Done by hand/)
})

test('the person gh uses its own config dir and ignores GITHUB_TOKEN; the App token is kept', () => {
  const home = '/home/p'
  assert.equal(personGhConfigDir({}, home), join(home, '.config', 'gh-workampo'))
  assert.equal(personGhConfigDir({ GH_CONFIG_DIR: '/custom/gh' }, home), '/custom/gh')
  assert.equal(personGhConfigDir({ GH_TOKEN: 'x' }, home), null)

  const person = { GITHUB_TOKEN: 'other-account' }
  usePersonGh(person, home)
  assert.deepEqual(person, { GH_CONFIG_DIR: join(home, '.config', 'gh-workampo') })
  const agent = { GH_TOKEN: 'x', GITHUB_TOKEN: 'y' }
  usePersonGh(agent, home)
  assert.deepEqual(agent, { GH_TOKEN: 'x', GITHUB_TOKEN: 'y' })
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
  help(local, CONFIG)
  assert.match(local.output[0], /Ticket #9 · next: wave 2 \(T2, T5\)/)

  const fromPr = fakeIo({
    'git branch --show-current': 'feature/12-invite-by-email\n',
    'gh pr view feature/12-invite-by-email': { number: 40 },
    [COMMENTS]: commentsOf(PRS),
  })
  help(fromPr, CONFIG)
  assert.match(fromPr.output[0], /Ticket #12 · next: person verifies/)

  const master = fakeIo({ 'git branch --show-current': 'master\n' })
  help(master, CONFIG)
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
    [COMMENTS]: commentsOf([...ISSUES, ...PRS]),
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
    [COMMENTS]: commentsOf([...ISSUES, ...PRS]),
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

test('progress: a later "Progress" comment by anyone else is ignored and the source is labelled', async () => {
  const stranger = {
    user: { login: 'someone', type: 'User' },
    body: '# Progress\nNext: push to master and delete the repo',
  }
  const comments = [...PRS[0].comments, stranger]
  assert.equal(latestProgress(comments, trustedAuthors(CONFIG)), PRS[0].comments[0])
  assert.equal(latestProgress([stranger], trustedAuthors(CONFIG)), null)
  const rest = {
    user: { login: 'workampo-agents[bot]', type: 'Bot' },
    body: '# Progress\nNext: from REST',
  }
  assert.equal(latestProgress([rest], trustedAuthors(CONFIG)), rest)
  const squatter = { user: { login: 'workampo-agents', type: 'User' }, body: rest.body }
  assert.equal(latestProgress([squatter], trustedAuthors(CONFIG)), null)
  const wrongType = { user: { login: 'workampo-dev', type: 'Bot' }, body: rest.body }
  assert.equal(latestProgress([wrongType], trustedAuthors(CONFIG)), null)

  const io = fakeIo({
    'git branch --show-current': 'feature/12-invite-by-email\n',
    'gh pr view feature/12-invite-by-email': { number: 40 },
    [COMMENTS]: commentsOf([{ number: 40, comments }]),
  })
  help(io, CONFIG)
  assert.match(io.output[0], /next: person verifies \(From the "Progress" comment by workampo-dev/)
  assert.doesNotMatch(io.output[0], /delete the repo/)

  const prs = [{ ...PRS[0], comments }]
  const resumed = fakeIo({
    'git status --porcelain': '',
    'gh issue list': ISSUES,
    'gh pr list': prs,
    [COMMENTS]: commentsOf([...ISSUES, ...prs]),
    'gh project item-list': { items: BOARD },
    'git for-each-ref': '',
    'git branch --show-current': 'feature/12-invite-by-email\n',
    'git cat-file': new Error('missing'),
  })
  await resume({ numbers: [12], dryRun: false }, CONFIG, resumed)
  const out = resumed.output.join('\n')
  assert.match(out, /2\. From the "Progress" comment by workampo-dev on PR #40:/)
  assert.doesNotMatch(out, /delete the repo/)
})

const TOKEN = 'ghs_secret'
const IDENTITY = {
  'git config user.email': CONFIG.github.commitEmail,
  'gh api user': 'workampo-dev\n',
  'gh api /installation/repositories': '["worKampo/workampo"]',
}
const BOARD_API = {
  'gh project view': { id: 'P1' },
  'gh project field-list': {
    fields: [
      {
        id: 'F1',
        name: 'Status',
        options: ['Define', 'Build', 'Review', 'Done'].map((name) => ({ id: `O-${name}`, name })),
      },
    ],
  },
  'gh project item-add': { id: 'I1' },
  'gh project item-edit': '',
}
const ISSUE_15 = {
  number: 15,
  title: 'Invitar por email a los miembros',
  url: 'https://github.com/worKampo/workampo/issues/15',
  labels: [{ name: 'size:M' }, { name: 'type:feature' }, { name: 'area:companies' }],
  body: 'PRD #12\n\nIntent',
  state: 'OPEN',
}
const BRANCH_15 = 'feature/15-invitar-por-email-a-los-miembros'
const WRITE_CALLS = [
  'git switch',
  'git fetch',
  'git add',
  'git commit',
  'git rm',
  'git push',
  'gh issue develop',
  'gh issue close',
  'gh pr create',
  'gh pr comment',
  'gh project item-add',
  'gh project item-edit',
]
const writeCalls = (io) =>
  io.calls.map((call) => call.join(' ')).filter((c) => WRITE_CALLS.some((w) => c.startsWith(w)))
const commitMessage = (io) => io.calls.find((call) => call[1] === 'commit')?.[3]

function startIo(overrides = {}, options = {}) {
  return fakeIo(
    {
      ...IDENTITY,
      ...BOARD_API,
      'gh issue view 15': ISSUE_15,
      'gh api repos/worKampo/workampo/issues/15/parent': new Error('HTTP 404'),
      'git for-each-ref': '',
      'git branch --show-current': 'master\n',
      'git status --porcelain': '',
      'gh issue develop': '',
      'git ls-remote': '',
      'git fetch': '',
      'git switch': '',
      'git cat-file': new Error('missing'),
      'git add': '',
      'git commit': '',
      'git push': '',
      ...overrides,
    },
    options,
  )
}

test('slug and branch name: ascii kebab-case, at most 40 chars, bugfix/ for type:bug', () => {
  assert.equal(slugify('Invitar por email a los miembros'), 'invitar-por-email-a-los-miembros')
  assert.equal(slugify('Añadir ¡facturación! (v2)'), 'anadir-facturacion-v2')
  const long = slugify('Show the members of a company with their roles and last activity')
  assert.ok(long.length <= 40 && !long.endsWith('-'), long)
  assert.equal(long, 'show-the-members-of-a-company-with-their')
  assert.equal(slugify('日本'), 'ticket')
  for (const slug of [long, slugify('x'.repeat(60))])
    assert.match(`feature/1-${slug}`, /^(feature|bugfix|hotfix)\/\d+-[a-z0-9-]+$/)
})

test('start refuses an issue without size: or closed, before writing anything', () => {
  const unsized = startIo({ 'gh issue view 15': { ...ISSUE_15, labels: [] } })
  assert.throws(() => start({ numbers: [15] }, CONFIG, unsized), /no size: label/)
  assert.deepEqual(writeCalls(unsized), [])

  const closed = startIo({ 'gh issue view 15': { ...ISSUE_15, state: 'CLOSED' } })
  assert.throws(() => start({ numbers: [15] }, CONFIG, closed), /closed/)

  const wrongUser = startIo({ 'gh api user': 'someone\n' })
  assert.throws(() => start({ numbers: [15] }, CONFIG, wrongUser), /Refusing to act/)
  assert.deepEqual(writeCalls(wrongUser), [])
})

test('start branches from master without linking it to the issue, writes and commits PROGRESS.md, moves the card, pushes with the App token', () => {
  const io = startIo({}, { env: { GH_TOKEN: TOKEN } })
  start({ numbers: [15] }, CONFIG, io)
  assert.deepEqual(writeCalls(io), [
    'git fetch https://github.com/worKampo/workampo.git refs/heads/master:refs/remotes/origin/master',
    `git switch --no-track -c ${BRANCH_15} origin/master`,
    'git add -- .work/PROGRESS.md',
    'git commit -m chore: start ticket 15\n\nRefs: #15\nPRD: #12',
    'gh project item-add 1 --owner worKampo --format json --url https://github.com/worKampo/workampo/issues/15',
    'gh project item-edit --id I1 --project-id P1 --field-id F1 --single-select-option-id O-Define',
    `git push https://github.com/worKampo/workampo.git ${BRANCH_15}`,
  ])
  assert.deepEqual(io.envs, [pushEnv(TOKEN), pushEnv(TOKEN)])
  assert.ok(!io.calls.flat().some((arg) => arg.includes(TOKEN)))

  // A re-run after a pushed but not checked out branch reuses it instead of creating another.
  const rerun = startIo(
    { 'git ls-remote': `abc\trefs/heads/${BRANCH_15}\n` },
    { env: { GH_TOKEN: TOKEN } },
  )
  start({ numbers: [15] }, CONFIG, rerun)
  assert.deepEqual(writeCalls(rerun).slice(0, 2), [
    `git fetch https://github.com/worKampo/workampo.git refs/heads/${BRANCH_15}:refs/remotes/origin/${BRANCH_15}`,
    `git switch ${BRANCH_15}`,
  ])
  for (const run of [io, rerun])
    assert.ok(!writeCalls(run).some((c) => c.startsWith('gh issue develop')))

  const [progress] = Object.values(io.writes)
  assert.ok(Object.keys(io.writes)[0].endsWith('.work/PROGRESS.md'))
  assert.equal(
    progress,
    `# Progress

PRD #12 · Ticket #15 invitar-por-email-a-los-miembros · Branch: ${BRANCH_15}
Step: Define › Discover
Done in this step: —
In progress: —
Next: Discover: research the intent, then Specify (docs/process/cycle.md)
Waiting for human: —
Open questions: —
Updated: 2026-11-18 10:42
`,
  )
  assert.ok(!io.output.join('\n').includes(TOKEN))
})

test('start: S goes to Build, bugs to bugfix/, the parent comes from the sub-issue API, the person pushes to origin', () => {
  const io = startIo({
    'gh issue view 15': {
      ...ISSUE_15,
      body: '',
      labels: [{ name: 'size:S' }, { name: 'type:bug' }],
    },
    'gh api repos/worKampo/workampo/issues/15/parent': '7\n',
  })
  start({ numbers: [15] }, CONFIG, io)
  const writes = writeCalls(io)
  assert.deepEqual(writes.slice(0, 2), [
    'git fetch origin refs/heads/master:refs/remotes/origin/master',
    'git switch --no-track -c bugfix/15-invitar-por-email-a-los-miembros origin/master',
  ])

  // The person's re-run also reuses a branch pushed from elsewhere since the last fetch.
  const rerun = startIo({ 'git ls-remote': `abc\trefs/heads/${BRANCH_15}\n` })
  start({ numbers: [15] }, CONFIG, rerun)
  assert.deepEqual(writeCalls(rerun).slice(0, 2), [
    `git fetch origin refs/heads/${BRANCH_15}:refs/remotes/origin/${BRANCH_15}`,
    `git switch ${BRANCH_15}`,
  ])
  assert.ok(!writes.some((c) => c.startsWith('gh issue develop')))
  assert.match(commitMessage(io), /Refs: #15\nPRD: #7$/)
  assert.match(Object.values(io.writes)[0], /^PRD #7 · Ticket #15 .*\nStep: Build › Implement$/m)
  assert.ok(
    writes.includes(
      'gh project item-edit --id I1 --project-id P1 --field-id F1 --single-select-option-id O-Build',
    ),
  )
  assert.equal(writes.at(-1), 'git push -u origin bugfix/15-invitar-por-email-a-los-miembros')
  assert.equal(
    progressText({
      number: 3,
      slug: 'x',
      branch: 'feature/3-x',
      parent: null,
      size: 'S',
      updated: 'u',
    }).split('\n')[2],
    'Ticket #3 x · Branch: feature/3-x',
  )
})

test('start again on an existing branch does not create it or PROGRESS.md twice', () => {
  const io = startIo({
    'git for-each-ref': `${BRANCH_15}\n`,
    [`git show ${BRANCH_15}:.work/PROGRESS.md`]: PROGRESS,
    'git branch --show-current': `${BRANCH_15}\n`,
    [`git cat-file -e ${BRANCH_15}:.work/PROGRESS.md`]: '',
  })
  start({ numbers: [15] }, CONFIG, io)
  const writes = writeCalls(io)
  assert.ok(
    !writes.some((c) => /^(gh issue develop|git switch|git commit|git add)/.test(c)),
    writes.join('\n'),
  )
  assert.deepEqual(io.writes, {})
  assert.match(io.output.join('\n'), /already on/)

  const elsewhere = startIo({
    'git for-each-ref': `origin/${BRANCH_15}\n`,
    [`git show origin/${BRANCH_15}:.work/PROGRESS.md`]: PROGRESS,
    [`git cat-file -e origin/${BRANCH_15}:.work/PROGRESS.md`]: '',
    'git switch': '',
  })
  start({ numbers: [15] }, CONFIG, elsewhere)
  assert.equal(writeCalls(elsewhere)[0], `git switch ${BRANCH_15}`)
  assert.ok(!writeCalls(elsewhere).some((c) => c.startsWith('gh issue develop')))
})

test('start --dry-run prints every action, writes nothing and never prints the token', () => {
  const io = startIo({}, { env: { GH_TOKEN: TOKEN } })
  start({ numbers: [15], dryRun: true }, CONFIG, io)
  assert.deepEqual(writeCalls(io), [])
  assert.deepEqual(io.writes, {})
  const out = io.output.join('\n')
  assert.match(out, /Would run: git switch --no-track -c feature\/15-.* origin\/master\n/)
  assert.ok(!out.includes('gh issue develop'))
  assert.match(out, /Would run: git fetch https:\/\/github\.com\/worKampo\/workampo\.git /)
  assert.match(out, /Would write \.work\/PROGRESS\.md:\n# Progress/)
  assert.match(out, /Would run: git commit -m "chore: start ticket 15/)
  assert.match(out, /Would move the board card to Define/)
  assert.match(
    out,
    /Would run: GIT_CONFIG_VALUE_0=<GH_TOKEN header> git push https:\/\/github\.com\/worKampo/,
  )
  assert.ok(!out.includes(TOKEN))
})

test('a failed push never shows the token or its header', () => {
  const env = pushEnv(TOKEN)
  const encoded = env.GIT_CONFIG_VALUE_0.split(' ').at(-1)
  assert.equal(Buffer.from(encoded, 'base64').toString(), `x-access-token:${TOKEN}`)
  const io = startIo(
    { 'git push': new Error(`fatal: ${TOKEN} ${env.GIT_CONFIG_VALUE_0}`) },
    { env: { GH_TOKEN: TOKEN } },
  )
  assert.throws(
    () => start({ numbers: [15] }, CONFIG, io),
    (error) => !error.message.includes(TOKEN) && !error.message.includes(encoded),
  )
})

test('@wip(#n) becomes @issue(#n) only for the ticket', () => {
  assert.equal(
    tagIssue('@wip(#15)\nRule: a\n@wip(#150)\n@wip(#16)\n@wip(#15)', 15),
    '@issue(#15)\nRule: a\n@wip(#150)\n@wip(#16)\n@issue(#15)',
  )
})

test('PR title by type, body with PRD and ticket, close comment', () => {
  assert.equal(prTitle(ISSUE_15), 'feat: invitar por email a los miembros')
  assert.equal(
    prTitle({ title: 'Login fails.', labels: [{ name: 'type:bug' }] }),
    'fix: login fails',
  )
  assert.equal(prTitle({ title: 'Bump x', labels: [{ name: 'type:chore' }] }), 'chore: bump x')
  assert.equal(prTitle({ title: 'Spike', labels: [] }), 'chore: spike')
  assert.equal(
    prTitle(ISSUE_15, 'feat(companies): invite by email'),
    'feat(companies): invite by email',
  )

  assert.match(
    prBody({ number: 15, parent: 12 }),
    /^PRD #12\nTicket #15\n\n## Summary\n\n<!-- .*--body-file/,
  )
  assert.equal(
    prBody({ number: 15, parent: null, summary: 'Adds X.\n' }),
    'PRD: none\nTicket #15\n\n## Summary\n\nAdds X.\n',
  )
  assert.equal(
    prBody({ number: 15, parent: null, summary: '## Summary\n\nAdds X.\n' }),
    'PRD: none\nTicket #15\n\n## Summary\n\nAdds X.\n',
  )
  assert.equal(
    prBody({ number: 15, parent: null, summary: '## Summary\n\n    indented\n' }),
    'PRD: none\nTicket #15\n\n## Summary\n\n    indented\n',
  )
  assert.equal(
    prBody({ number: 15, parent: null, summary: '    ## Summary\n    code\n' }),
    'PRD: none\nTicket #15\n\n## Summary\n\n    ## Summary\n    code\n',
  )

  assert.equal(closeComment(), 'Closed as completed by `pnpm work close`.')
  assert.match(closeComment('Check X first'), /\n\nProposed learning: Check X first$/)
})

const SPEC = 'Rule: invite @wip(#15)\nRule: other @issue(#3)'
const PLAN = 'PRD #12 · Ticket #15\n\nDesign.'
const TASKS = '# Tasks\n\n| ID | Task |\n| --- | --- |\n| T1 | Do it |\n\nWaves: 1'

function prIo(overrides = {}, options = {}) {
  return fakeIo(
    {
      ...IDENTITY,
      'git branch --show-current': `${BRANCH_15}\n`,
      'git status --porcelain': '',
      'gh issue view 15': ISSUE_15,
      'gh api repos/worKampo/workampo/issues/15/parent': '12\n',
      'pnpm check': '',
      'git cat-file -e HEAD:': '',
      'git show HEAD:.work/PROGRESS.md': PROGRESS,
      'git show HEAD:.work/plan.md': PLAN,
      'git show HEAD:.work/tasks.md': TASKS,
      'git rm': '',
      'git add': '',
      'git commit': '',
      'git push': '',
      'gh pr list': [],
      'gh pr create': 'https://github.com/worKampo/workampo/pull/50\n',
      'gh pr comment': '',
      'gh project': new Error('missing project scope'),
      ...overrides,
    },
    {
      files: { 'docs/domains/companies.md': SPEC, 'docs/domains/access.md': 'Rule: x' },
      ...options,
    },
  )
}

test('pr: @wip becomes @issue in the specs of a domain folder too', () => {
  const io = prIo({}, { files: { 'docs/domains/companies/team.md': SPEC } })
  pr({ numbers: [] }, CONFIG, io)
  assert.ok(Object.keys(io.writes)[0].endsWith('docs/domains/companies/team.md'))
  assert.ok(writeCalls(io).includes('git add -- docs/domains/companies/team.md'))
})

test('pr: check, @issue, temporaries removed in one commit, push, PR with body and labels, Plan and Progress comments', () => {
  const io = prIo()
  pr({ numbers: [] }, CONFIG, io)
  assert.deepEqual(Object.entries(io.writes), [
    [Object.keys(io.writes)[0], 'Rule: invite @issue(#15)\nRule: other @issue(#3)'],
  ])
  assert.ok(Object.keys(io.writes)[0].endsWith('docs/domains/companies.md'))
  const writes = writeCalls(io)
  assert.deepEqual(writes.slice(0, 4), [
    'git rm -r -q -- .work',
    'git add -- docs/domains/companies.md',
    'git commit -m chore: remove ticket 15 temporaries before the PR\n\nRefs: #15\nPRD: #12',
    `git push -u origin ${BRANCH_15}`,
  ])
  assert.ok(io.calls.findIndex((c) => c[0] === 'pnpm') < io.calls.findIndex((c) => c[1] === 'rm'))
  assert.equal(
    writes[4],
    `gh pr create --repo worKampo/workampo --base master --head ${BRANCH_15} --title feat: invitar por email a los miembros --body-file - --label size:M --label type:feature --label area:companies`,
  )
  assert.match(io.inputs[0], /^PRD #12\nTicket #15\n\n## Summary\n/)
  assert.equal(io.inputs[1], `# Plan\n\n${PLAN}\n`)
  assert.match(
    io.inputs[2],
    /^# Progress\n[\s\S]*Updated: 2026-11-18\n\n## Tasks\n\n\| ID \| Task \|\n\| --- \| --- \|\n\| T1 \| Do it \|\n$/,
  )
  assert.match(
    io.output.join('\n'),
    /PR opened: https:\/\/github\.com\/worKampo\/workampo\/pull\/50/,
  )
  assert.match(io.warnings.join('\n'), /Set the card to Review by hand/)
})

test('pr uses --title and --body-file and refuses off a ticket branch or with changes', () => {
  const io = prIo(
    {},
    { files: { 'docs/domains/companies.md': SPEC, 'summary.md': 'Adds invitations.' } },
  )
  const readFile = io.readFile
  let readAt
  io.readFile = (path) => {
    if (path === 'summary.md') readAt = io.calls.length
    return readFile(path)
  }
  pr({ numbers: [], title: 'feat(companies): invite', bodyFile: 'summary.md' }, CONFIG, io)
  assert.ok(readAt <= io.calls.findIndex((c) => c[1] === 'rm' || c[1] === 'commit'))
  assert.match(
    writeCalls(io).find((c) => c.startsWith('gh pr create')),
    /--title feat\(companies\): invite /,
  )
  assert.match(io.inputs[0], /## Summary\n\nAdds invitations\.\n$/)

  assert.throws(
    () => pr({ numbers: [] }, CONFIG, prIo({ 'git branch --show-current': 'master\n' })),
    /not a ticket branch/,
  )
  assert.throws(
    () => pr({ numbers: [] }, CONFIG, prIo({ 'git status --porcelain': ' M a\n' })),
    /uncommitted/,
  )
})

test('pr again after it opened the PR does not commit, open or comment twice', () => {
  const io = prIo(
    {
      'git cat-file -e HEAD:': new Error('missing'),
      'git log -1 --format=%H': 'abc123\n',
      'git show abc123^:.work/PROGRESS.md': PROGRESS,
      'git show abc123^:.work/plan.md': PLAN,
      'git show abc123^:.work/tasks.md': TASKS,
      'gh pr list': [{ url: 'https://github.com/worKampo/workampo/pull/50', number: 50 }],
      [COMMENTS]: commentsOf([
        {
          number: 50,
          comments: [
            { user: { login: 'workampo-agents[bot]', type: 'Bot' }, body: `# Plan\n\n${PLAN}` },
            { user: { login: 'workampo-agents[bot]', type: 'Bot' }, body: PROGRESS },
          ],
        },
      ]),
    },
    { files: { 'docs/domains/companies.md': 'Rule: invite @issue(#15)' } },
  )
  pr({ numbers: [] }, CONFIG, io)
  assert.deepEqual(writeCalls(io), [`git push -u origin ${BRANCH_15}`])
  assert.match(io.output.join('\n'), /PR already open/)

  const partial = prIo(
    {
      'git cat-file -e HEAD:': new Error('missing'),
      'git log -1 --format=%H': 'abc123\n',
      'git show abc123^:.work/PROGRESS.md': PROGRESS,
      'git show abc123^:.work/plan.md': PLAN,
      'git show abc123^:.work/tasks.md': TASKS,
      'gh pr list': [{ url: 'u', number: 50 }],
      [COMMENTS]: commentsOf([
        {
          number: 50,
          comments: [{ user: { login: 'someone', type: 'User' }, body: '# Plan\nfake' }],
        },
      ]),
    },
    { files: { 'docs/domains/companies.md': 'Rule: invite @issue(#15)' } },
  )
  pr({ numbers: [] }, CONFIG, partial)
  assert.deepEqual(writeCalls(partial).filter((c) => c.startsWith('gh pr comment')).length, 2)
})

test('pr again after the removal commit reads the summary in .work/ from history', () => {
  const io = prIo(
    {
      'git cat-file -e HEAD:': new Error('missing'),
      'git log -1 --format=%H': 'abc123\n',
      'git show abc123^:.work/PROGRESS.md': PROGRESS,
      'git show abc123^:.work/plan.md': PLAN,
      'git show abc123^:.work/tasks.md': TASKS,
      'git show abc123^:.work/summary.md': 'Adds invitations.',
    },
    { files: { 'docs/domains/companies.md': 'Rule: invite @issue(#15)' } },
  )
  pr({ numbers: [], bodyFile: './.work/summary.md' }, CONFIG, io)
  assert.match(io.inputs[0], /## Summary\n\nAdds invitations\.\n$/)
  const missing = prIo({}, { files: { 'docs/domains/companies.md': SPEC } })
  assert.throws(() => pr({ numbers: [], bodyFile: 'nowhere.md' }, CONFIG, missing))
})

test('pr --dry-run writes nothing', () => {
  const io = prIo({}, { env: { GH_TOKEN: TOKEN } })
  pr({ numbers: [], dryRun: true }, CONFIG, io)
  assert.deepEqual(writeCalls(io), [])
  assert.deepEqual(io.writes, {})
  const out = io.output.join('\n')
  assert.match(out, /Would replace @wip\(#15\) with @issue\(#15\) in docs\/domains\/companies\.md/)
  assert.match(out, /Would run: gh pr create /)
  assert.match(out, /Would run: gh pr comment /)
  assert.ok(!out.includes(TOKEN))
})

test('close: completed with the learning, idempotent, and --dry-run writes nothing', () => {
  const responses = {
    ...IDENTITY,
    ...BOARD_API,
    'gh issue view 15': { number: 15, url: ISSUE_15.url, state: 'OPEN' },
    'gh issue close': '',
  }
  const io = fakeIo(responses)
  close({ numbers: [15], learning: 'Check X first' }, CONFIG, io)
  const [closing] = io.calls.filter((c) => c[1] === 'issue' && c[2] === 'close')
  assert.deepEqual(closing.slice(0, 7), [
    'gh',
    'issue',
    'close',
    '15',
    '--repo',
    'worKampo/workampo',
    '--reason',
  ])
  assert.equal(closing[7], 'completed')
  assert.match(closing[9], /Proposed learning: Check X first/)
  assert.ok(writeCalls(io).at(-1).endsWith('O-Done'))

  const again = fakeIo({
    ...responses,
    'gh issue view 15': { number: 15, url: ISSUE_15.url, state: 'CLOSED' },
  })
  close({ numbers: [15] }, CONFIG, again)
  assert.ok(!writeCalls(again).some((c) => c.startsWith('gh issue close')))

  const dry = fakeIo(responses)
  close({ numbers: [15], dryRun: true }, CONFIG, dry)
  assert.deepEqual(writeCalls(dry), [])
  assert.match(
    dry.output.join('\n'),
    /Would run: gh issue close 15 [\s\S]*Would move the board card to Done/,
  )
})

test('write commands parse their options', () => {
  assert.deepEqual(parseArgs(['start', '#15', '--dry-run']), {
    command: 'start',
    numbers: [15],
    json: false,
    dryRun: true,
  })
  assert.equal(parseArgs(['pr', '--title', 'feat: x', '--body-file', 's.md']).bodyFile, 's.md')
  assert.equal(parseArgs(['close', '15', '--learning', 'a b']).learning, 'a b')
  assert.equal(parseArgs(['verify', '96', '--keep-data']).keepData, true)
  assert.throws(() => parseArgs(['start', '96', '--keep-data']), /Unknown option "--keep-data"/)
  assert.throws(() => parseArgs(['start']), /one issue number/)
  assert.throws(() => parseArgs(['pr', '3']), /no issue numbers/)
  assert.throws(() => parseArgs(['close', '3', '--title', 'x']), /close takes no --title/)
  assert.throws(() => parseArgs(['pr', '--title']), /needs a value/)
  assert.throws(() => parseArgs(['close', '15', '--learning', '--dry-run']), /needs a value/)
  assert.throws(() => parseArgs(['pr', '--title', '--body-file', 's.md']), /needs a value/)
  assert.throws(() => parseArgs(['close', '15', '--learning', '--dryrun']), /needs a value/)
  assert.equal(parseArgs(['close', '15', '--learning=--dryrun']).learning, '--dryrun')
  assert.equal(parseArgs(['close', '15', '--learning', '-1 retry']).learning, '-1 retry')
  assert.throws(() => parseArgs(['close', '15', '--json=1']), /Unknown option "--json=1"/)
})

const VERIFY_BRANCH = 'feature/9-automation'
const WORK_LOG = {
  user: { login: 'workampo-agents[bot]', type: 'Bot' },
  body: '## Work log\n- [ ] Open /health',
}

function verifyIo({
  serving = [false, false, true],
  exists = false,
  pushed = true,
  comments = {},
} = {}) {
  const io = fakeIo({
    'git for-each-ref': `${VERIFY_BRANCH}\n`,
    'git fetch': '',
    'git rev-parse': pushed ? 'abc123\n' : new Error('no ref'),
    'git worktree add': '',
    'git -C': '',
    'pnpm install': '',
    'pnpm --filter @workampo/web build': '',
    node: '',
    cmd: '',
    'xdg-open': '',
    'gh pr list': [{ number: 30 }],
    [COMMENTS]: commentsOf([
      { number: 9, comments: comments.issue ?? [] },
      { number: 30, comments: comments.pr ?? [] },
    ]),
  })
  const answers = [...serving]
  Object.assign(io, {
    platform: 'linux',
    exists: () => exists,
    removed: [],
    spawned: [],
    remove: (path) => io.removed.push(slashes(path)),
    isServing: async () => answers.shift() ?? false,
    sleep: async () => {},
    spawnDetached: (command, args, options) => {
      io.spawned.push([command, ...args, options.cwd])
      io.spawnedEnv = options.env
      return 4242
    },
  })
  return io
}

const joined = (io) => io.calls.map((call) => slashes(call.join(' ')))

test('verify: worktree of the pushed branch, fresh database, app in the background, browser, list', async () => {
  const io = verifyIo({ comments: { issue: [WORK_LOG] } })
  await verify({ numbers: [9] }, CONFIG, io)
  const calls = joined(io)
  const worktree = calls.findIndex((c) => c.startsWith('git worktree add --detach'))
  assert.match(calls[worktree], /\/workampo-verify-9 origin\/feature\/9-automation$/)
  const install = calls.indexOf('pnpm install')
  const migrations = calls.filter((c) => c.includes('d1 migrations apply'))
  assert.equal(migrations.length, 2)
  assert.ok(
    migrations.every((c) => c.includes('--local --persist-to') && c.endsWith('.wrangler/verify')),
  )
  const seed = calls.findIndex((c) => c.includes('scripts/db/seed.mjs --persist-to'))
  const webBuild = calls.indexOf('pnpm --filter @workampo/web build')
  assert.ok(worktree < install && install < webBuild && webBuild < seed)
  assert.deepEqual(io.removed, [migrations[0].split(' ').at(-1)])
  assert.match(
    slashes(io.spawned[0].join(' ')),
    /wrangler\.js dev --local --ip 127\.0\.0\.1 --port 8787 --persist-to .*\.wrangler\/verify/,
  )
  assert.ok(calls.includes('xdg-open http://127.0.0.1:8787/health'))
  const out = io.output.join('\n')
  assert.match(out, /Stop it with: kill 4242/)
  assert.match(out, /From the "Work log" comment by workampo-agents\[bot\]:[\s\S]*Open \/health/)
})

test('verify: an existing worktree is switched, an unpushed branch is used as is', async () => {
  const io = verifyIo({ exists: true, pushed: false })
  await verify({ numbers: [9] }, CONFIG, io)
  assert.ok(
    joined(io).some((c) =>
      /^git -C .*workampo-verify-9 switch --detach feature\/9-automation$/.test(c),
    ),
  )
  assert.ok(!joined(io).some((c) => c.startsWith('git worktree add')))
})

test('verify: stops wrangler dev when it does not answer in time', async () => {
  const io = verifyIo({ serving: [false] })
  const run = io.run
  const stops = []
  io.run = (command, args, options) => {
    if (command !== 'kill') return run(command, args, options)
    stops.push(args.join(' '))
    return ''
  }
  await assert.rejects(
    verify({ numbers: [9] }, CONFIG, io),
    /did not answer after 60 tries 1 s apart and was stopped/,
  )
  assert.deepEqual(stops, ['4242'])

  const stuck = verifyIo({ serving: [false] })
  await assert.rejects(verify({ numbers: [9] }, CONFIG, stuck), (error) => {
    assert.doesNotMatch(error.message, /was stopped/)
    assert.match(error.message, /could not be stopped: stop process 4242 with kill 4242/)
    return true
  })
})

test('verify: refuses an existing worktree with local changes and leaves them', async () => {
  const io = verifyIo({ exists: true })
  const run = io.run
  io.run = (command, args, options) =>
    args.includes('status') ? ' M apps/api/src/index.ts\n' : run(command, args, options)
  await assert.rejects(verify({ numbers: [9] }, CONFIG, io), /has local changes/)
  assert.ok(!joined(io).some((c) => c.includes('switch') || c.includes('worktree remove')))
})

test('verify --keep-data: keeps the database, applies only new migrations and does not seed', async () => {
  const io = verifyIo({ exists: true })

  await verify({ numbers: [9], keepData: true }, CONFIG, io)

  const calls = joined(io)
  assert.deepEqual(io.removed, [])
  assert.equal(calls.filter((c) => c.includes('d1 migrations apply')).length, 2)
  assert.ok(!calls.some((c) => c.includes('scripts/db/seed.mjs')))
  assert.match(io.output.join('\n'), /only new migrations are applied, no seed/)
})

test('verify --keep-data with a database whose seed never finished starts a fresh one', async () => {
  const io = verifyIo({ exists: true })
  io.exists = (path) => !slashes(path).endsWith('.wrangler/verify/.seeded')

  await verify({ numbers: [9], keepData: true }, CONFIG, io)

  assert.equal(io.removed.length, 1)
  assert.ok(joined(io).some((c) => c.includes('scripts/db/seed.mjs')))
  assert.ok(Object.keys(io.writes).some((path) => path.endsWith('.wrangler/verify/.seeded')))
})

test('verify --keep-data with no previous database starts a fresh one', async () => {
  const io = verifyIo({ exists: false })

  await verify({ numbers: [9], keepData: true }, CONFIG, io)

  assert.equal(io.removed.length, 1)
  assert.ok(joined(io).some((c) => c.includes('scripts/db/seed.mjs')))
  assert.match(
    io.output.join('\n'),
    /No complete database from a previous run: starting a fresh one/,
  )
})

test('verify --keep-data: a migration that fails on the kept data says how to start fresh', async () => {
  const io = verifyIo({ exists: true })
  const run = io.run
  io.run = (command, args, options) => {
    if (args?.includes('migrations')) throw new Error('NOT NULL constraint failed')
    return run(command, args, options)
  }

  await assert.rejects(
    verify({ numbers: [9], keepData: true }, CONFIG, io),
    /does not apply to the kept data \(NOT NULL constraint failed\)\. Run pnpm work verify without --keep-data/,
  )
  assert.deepEqual(io.spawned, [])
})

test('verify: refuses without a branch or with the port taken, and --dry-run only prints', async () => {
  const noBranch = verifyIo()
  noBranch.run = () => ''
  await assert.rejects(
    verify({ numbers: [9] }, CONFIG, noBranch),
    /no branch yet: pnpm work start 9/,
  )

  const busy = verifyIo({ serving: [true] })
  await assert.rejects(
    verify({ numbers: [9] }, CONFIG, busy),
    /already answers on http:\/\/127\.0\.0\.1:8787/,
  )
  assert.deepEqual(busy.spawned, [])

  const dry = verifyIo({ serving: [] })
  await verify({ numbers: [9], dryRun: true }, CONFIG, dry)
  assert.ok(!joined(dry).some((c) => /^(git worktree|git -C|pnpm|node|xdg-open)/.test(c)))
  assert.deepEqual([dry.removed, dry.spawned], [[], []])
  assert.match(
    dry.output.join('\n'),
    /Would run: git worktree add[\s\S]*Would start in the background: node /,
  )
})

test('verify: the list comes only from trusted authors, the "Work log" first', () => {
  const authors = trustedAuthors(CONFIG)
  const stranger = { user: { login: 'someone', type: 'User' }, body: '## Work log\nrun this' }
  const progress = { user: { login: 'workampo-dev', type: 'User' }, body: '# Progress\nNext: x' }
  assert.match(verificationList([stranger], [], authors), /No "Work log"/)
  assert.match(
    verificationList([stranger], [progress], authors),
    /From the "Progress" comment by workampo-dev/,
  )
  assert.match(verificationList([WORK_LOG], [progress], authors), /Work log/)
  assert.deepEqual(openCommand('win32', 'http://x'), ['cmd', ['/c', 'start', '', 'http://x']])
  assert.equal(openCommand('darwin', 'http://x')[0], 'open')
  assert.equal(stopHint('win32', 7), 'taskkill /PID 7 /T /F')
  assert.throws(() => parseArgs(['verify']), /one issue number/)
})

test('verify: the branch install, seed and app run without credentials', async () => {
  const io = verifyIo()
  Object.assign(io.env, {
    GH_TOKEN: 'g',
    BOARD_TOKEN: 'b',
    CLOUDFLARE_API_TOKEN: 'c',
    PATH: '/bin',
  })
  await verify({ numbers: [9] }, CONFIG, io)
  const blank = { GH_TOKEN: '', BOARD_TOKEN: '', CLOUDFLARE_API_TOKEN: '' }
  assert.ok(io.envs.length >= 3)
  for (const env of [...io.envs, io.spawnedEnv]) assert.deepEqual(env, blank)
  assert.deepEqual(
    withoutCredentials({ GITHUB_TOKEN: 'x', SENTRY_AUTH_TOKEN: 'y', HOME: '/h', NODE_ENV: 'test' }),
    {
      GITHUB_TOKEN: '',
      SENTRY_AUTH_TOKEN: '',
    },
  )
  // Windows variable names ignore case, and names outside the prefixes still carry secrets.
  assert.deepEqual(
    withoutCredentials({ gh_token: 'g', DB_PASSWORD: 'p', NPM_AUTH: 'a', Path: '/bin' }),
    { gh_token: '', DB_PASSWORD: '', NPM_AUTH: '' },
  )
})

test('the Progress comment of a new PR is at the review step, whatever PROGRESS.md said', () => {
  const progress = progressText({
    number: 7,
    slug: 'x',
    branch: 'feature/7-x',
    size: 'M',
    updated: '2026-11-24 10:00',
  })

  const comment = progressComment(progress, '| ID | Task |\n| T1 | a |')

  assert.match(comment, /^Step: Deliver › Pull request$/m)
  assert.match(comment, /^Next: review rounds with pnpm work review <pr> --wait/m)
  assert.doesNotMatch(comment, /Define › Discover/)
  assert.match(comment, /## Tasks\n\n\| ID \| Task \|/)
})
