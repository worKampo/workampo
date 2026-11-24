// Ticket cycle commands (ADR-0052): node scripts/work/work.mjs [command] [args]
// gh and git run as child processes with argument arrays; tokens only travel through the environment.
import { execFileSync, spawn } from 'node:child_process'
import {
  existsSync,
  mkdirSync,
  openSync,
  readdirSync,
  readFileSync,
  rmSync,
  writeFileSync,
} from 'node:fs'
import { homedir } from 'node:os'
import { dirname, join, sep } from 'node:path'
import { createInterface } from 'node:readline/promises'
import { fileURLToPath, pathToFileURL } from 'node:url'
import { parse } from 'yaml'
import { LOCAL_DATABASES } from '../db/seed.mjs'
import { checkReviewArgs, REVIEW_HELP, review } from './review.mjs'

const ROOT = fileURLToPath(new URL('../../', import.meta.url))
const BRANCH_TICKET = /^(?:feature|bugfix|hotfix)\/(\d+)-/
const ACTIVE_COLUMNS = ['Define', 'Build', 'Review']
const EMPTY_VALUES = ['', '—', '-']
const COMMANDS = ['help', 'status', 'inbox', 'resume', 'start', 'pr', 'close', 'verify', 'review']
const VALUE_OPTIONS = {
  '--title': 'title',
  '--body-file': 'bodyFile',
  '--learning': 'learning',
  '--reply': 'reply',
  '--commit': 'commit',
  '--text': 'text',
  '--not-applicable': 'notApplicable',
}
const PROGRESS_FILE = '.work/PROGRESS.md'
const PLAN_FILE = '.work/plan.md'
const TASKS_FILE = '.work/tasks.md'
const SPECS_DIR = 'docs/domains'
const SLUG_MAX = 40
export const VERIFY_URL = 'http://127.0.0.1:8787'
const VERIFY_PERSIST = '.wrangler/verify'
const VERIFY_LOG = '.wrangler/verify.log'
const SEEDED_MARKER = '.seeded'
const WRANGLER = 'node_modules/wrangler/bin/wrangler.js'

export const HELP = `Usage: pnpm work <command> [args]

  status [n…] [--json]    What is in progress; with numbers, the detail of those tickets
  inbox [--json]          Only what waits for the person, with links
  resume [n] [--dry-run]  Switch to the ticket's branch and print where to continue
  start <n> [--dry-run]   Create the ticket's branch and .work/PROGRESS.md, move the card
  pr [--title "<title>"] [--body-file <summary.md>] [--dry-run]
                          On a ticket branch: pnpm check, @wip to @issue, remove .work/, push, open the PR
  close <n> [--learning "<text>"] [--dry-run]
                          Close the issue as completed and move the card to Done
  verify <n> [--keep-data] [--dry-run]
                          Worktree of the ticket's branch, fresh local database, app running,
                          browser open, and the verification list. --keep-data keeps the
                          previous run's database and applies only new migrations
${REVIEW_HELP}

Issue numbers are written 15 or #15.`

export function parseIssueNumber(value) {
  const match = String(value)
    .trim()
    .match(/^#?([1-9]\d*)$/)
  if (!match) throw new Error(`"${value}" is not an issue number: write 15 or #15.`)
  return Number(match[1])
}

export function parseArgs(argv) {
  const [first = 'help', ...rest] = argv
  const command = ['-h', '--help'].includes(first) ? 'help' : first
  if (!COMMANDS.includes(command)) throw new Error(`Unknown command "${command}".\n\n${HELP}`)
  const args = { command, numbers: [], json: false, dryRun: false }
  for (let i = 0; i < rest.length; i++) {
    const arg = rest[i]
    const eq = arg.indexOf('=')
    const option = arg.startsWith('--') && eq > 0 ? arg.slice(0, eq) : arg
    if (VALUE_OPTIONS[option]) {
      const inline = option === arg ? undefined : arg.slice(eq + 1)
      const value = inline ?? rest[++i]
      // `--learning --dryrun` would otherwise eat a misspelled flag and close for real; text
      // that starts with `--` goes on purpose as `--learning=--text`.
      if (value === undefined || (inline === undefined && value.startsWith('--')))
        throw new Error(`${option} needs a value (write ${option}=<value> if it starts with --).`)
      args[VALUE_OPTIONS[option]] = value
    } else if (arg === '--json') args.json = true
    else if (arg === '--dry-run') args.dryRun = true
    else if (arg === '--keep-data' && command === 'verify') args.keepData = true
    else if (arg === '--wait' && command === 'review') args.wait = true
    else if (arg.startsWith('-')) throw new Error(`Unknown option "${arg}".\n\n${HELP}`)
    else args.numbers.push(parseIssueNumber(arg))
  }
  if (command === 'resume' && args.numbers.length > 1)
    throw new Error('resume takes at most one issue number.')
  if (['inbox', 'pr'].includes(command) && args.numbers.length)
    throw new Error(`${command} takes no issue numbers.`)
  if (['start', 'close', 'verify', 'review'].includes(command) && args.numbers.length !== 1)
    throw new Error(`${command} takes one issue number.`)
  const allowed =
    {
      pr: ['title', 'bodyFile'],
      close: ['learning'],
      review: ['reply', 'commit', 'text', 'notApplicable'],
    }[command] ?? []
  for (const [option, key] of Object.entries(VALUE_OPTIONS))
    if (key in args && !allowed.includes(key)) throw new Error(`${command} takes no ${option}.`)
  if (command === 'review') checkReviewArgs(args)
  return args
}

export function ticketFromBranch(branch) {
  const match = branch?.match(BRANCH_TICKET)
  return match ? Number(match[1]) : null
}

// "Key: value" lines of .work/PROGRESS.md or a "Progress" comment, keyed in lower case.
export function parseProgress(text) {
  const fields = {}
  for (const line of text.split(/\r?\n/)) {
    const match = line.match(/^([A-Z][A-Za-z ]*):\s*(.*)$/)
    if (match) fields[match[1].toLowerCase()] = match[2].trim()
  }
  return fields
}

export function nextStep(progressText) {
  return progressText ? (parseProgress(progressText).next ?? null) : null
}

export function commentAuthor(comment) {
  return comment.user?.login ?? null
}

// Anyone can comment on the public repo: only comments by the App or the project account are read,
// so a stranger's comment cannot feed instructions to an agent. The type is checked because
// anyone can register the App's bare name as a user; only the REST API tells users from bots.
export function trustedAuthors(config) {
  return [
    { login: config.github.account, type: 'User' },
    { login: `${config.github.agentsApp.name}[bot]`, type: 'Bot' },
  ]
}

// REST serves the comments of issues and PRs alike; `gh ... --json comments` hides the author type.
export function readComments(io, repository, number) {
  const lines = io.run('gh', [
    'api',
    `repos/${repository}/issues/${number}/comments`,
    '--paginate',
    '--jq',
    '.[]',
  ])
  return lines
    .split(/\r?\n/)
    .filter(Boolean)
    .map((line) => JSON.parse(line))
}

function isHeadedBy(comment, heading, authors) {
  const firstLine = (comment.body ?? '').split('\n')[0]
  const { login, type } = comment.user ?? {}
  return authors.some((a) => a.login === login && a.type === type) && heading.test(firstLine)
}

const PROGRESS_HEADING = /^\s*#{1,6}\s*Progress\s*$/
const PLAN_HEADING = /^\s*#{1,6}\s*Plan\s*$/
const WORK_LOG_HEADING = /^\s*#{1,6}\s*Work log\s*$/

export function latestProgress(comments, authors) {
  return (comments ?? []).findLast((c) => isHeadedBy(c, PROGRESS_HEADING, authors)) ?? null
}

function progressSource(comment, where) {
  return `From the "Progress" comment by ${commentAuthor(comment)} on ${where}`
}

export function isSet(value) {
  return value != null && !EMPTY_VALUES.includes(String(value).trim())
}

export function taskCounts(body = '') {
  const boxes = [...body.matchAll(/^\s*[-*] \[([ xX])\]/gm)]
  return { done: boxes.filter((box) => box[1] !== ' ').length, total: boxes.length }
}

export function sizeOf(labels = []) {
  const label = labels.map((l) => l.name).find((name) => name.startsWith('size:'))
  return label ? label.slice('size:'.length) : '?'
}

// gh names a custom field's JSON key after the field ("Espera a" → "espera a").
export function boardField(item, name) {
  const normalize = (text) => text.toLowerCase().replace(/[^a-z]/g, '')
  const key = Object.keys(item).find((k) => normalize(k) === normalize(name))
  return key ? item[key] : null
}

function boardIssueNumber(item, repository) {
  const content = item.content ?? {}
  if (content.type !== 'Issue') return null
  if (content.repository && content.repository !== repository) return null
  return content.number ?? null
}

export function ciSummary(rollup = []) {
  if (!rollup.length) return 'no checks'
  const failed = [
    'FAILURE',
    'ERROR',
    'CANCELLED',
    'TIMED_OUT',
    'ACTION_REQUIRED',
    'STARTUP_FAILURE',
  ]
  if (rollup.some((check) => failed.includes(check.conclusion ?? check.state))) return 'failing'
  const pending = rollup.some((check) =>
    check.state ? ['PENDING', 'EXPECTED'].includes(check.state) : check.status !== 'COMPLETED',
  )
  return pending ? 'pending' : 'passing'
}

// Progress lives in the PR comment once there is a PR, before that in .work/PROGRESS.md on the branch,
// and in issue comments after the merge or on a PRD (docs/procedures/progress.md).
export function buildTicket(number, data) {
  const issue = data.issues.find((i) => i.number === number)
  const pr = data.prs.find((p) => ticketFromBranch(p.headRefName) === number)
  const branch = data.branches.get(number)
  const item = data.board?.find((i) => boardIssueNumber(i, data.repository) === number)
  const prComment = pr && latestProgress(pr.comments, data.authors)
  const issueComment = latestProgress(issue?.comments, data.authors)
  const [progressText, source] = prComment
    ? [prComment.body, progressSource(prComment, `PR #${pr.number}`)]
    : branch?.progress
      ? [branch.progress, PROGRESS_FILE]
      : issueComment
        ? [issueComment.body, progressSource(issueComment, `issue #${number}`)]
        : [null, null]
  const progress = progressText ? parseProgress(progressText) : {}
  return {
    number,
    title: issue?.title ?? '',
    url: issue?.url ?? '',
    size: sizeOf(issue?.labels),
    column: item ? boardField(item, 'Status') : null,
    waitingOn: item ? boardField(item, 'Espera a') : null,
    step: progress.step ?? null,
    next: progress.next ?? null,
    waitingForHuman: progress['waiting for human'] ?? null,
    openQuestions: progress['open questions'] ?? null,
    ...taskCounts(issue?.body),
    branch: pr?.headRefName ?? branch?.branch ?? null,
    pr: pr
      ? { number: pr.number, url: pr.url, isDraft: pr.isDraft, ci: ciSummary(pr.statusCheckRollup) }
      : null,
    progress: progressText,
    progressSource: source,
  }
}

// Without the board, branches with a ticket number stand in for the Define and Build columns.
export function activeTickets(data) {
  const numbers = new Set(data.prs.map((pr) => ticketFromBranch(pr.headRefName)))
  if (data.board) {
    for (const item of data.board)
      if (ACTIVE_COLUMNS.includes(boardField(item, 'Status')))
        numbers.add(boardIssueNumber(item, data.repository))
  } else for (const number of data.branches.keys()) numbers.add(number)
  return [...numbers]
    .filter((n) => data.issues.some((issue) => issue.number === n))
    .sort((a, b) => a - b)
    .map((n) => buildTicket(n, data))
}

export function statusLine(ticket) {
  const step = ticket.step ?? ticket.column ?? 'no step recorded'
  return `#${ticket.number} ${ticket.size} · ${ticket.title} · ${step} · tasks ${ticket.done}/${ticket.total} · next: ${ticket.next ?? '—'}`
}

export function statusDetail(ticket, issueBody = '') {
  const tasks = issueBody.split(/\r?\n/).filter((line) => /^\s*[-*] \[[ xX]\]/.test(line))
  return [
    `#${ticket.number} ${ticket.title} (size ${ticket.size}${ticket.column ? `, ${ticket.column}` : ''})`,
    `Issue: ${ticket.url}`,
    `PR: ${ticket.pr ? `${ticket.pr.url}${ticket.pr.isDraft ? ' (draft)' : ''} · CI ${ticket.pr.ci}` : '—'}`,
    `Branch: ${ticket.branch ?? '—'}`,
    `Step: ${ticket.step ?? '—'}`,
    `Tasks ${ticket.done}/${ticket.total}${tasks.length ? `:\n${tasks.map((t) => `  ${t.trim()}`).join('\n')}` : ''}`,
    `Next: ${ticket.next ?? '—'}`,
    `Waiting for human: ${ticket.waitingForHuman ?? '—'}`,
    `Open questions: ${ticket.openQuestions ?? '—'}`,
  ].join('\n')
}

function isApprovedBy(pr, account) {
  const latest = (pr.reviews ?? []).filter((review) => review.author?.login === account).at(-1)
  return latest?.state === 'APPROVED'
}

export function buildInbox(data, runs, account) {
  const items = []
  for (const pr of data.prs)
    if (!pr.isDraft && !isApprovedBy(pr, account))
      items.push({ kind: 'review', text: `PR #${pr.number} to review: ${pr.title}`, url: pr.url })
  for (const run of runs)
    items.push({
      kind: 'deployment',
      text: `Deployment waiting for approval: ${run.name} ${run.head_sha.slice(0, 7)}`,
      url: run.html_url,
    })
  for (const issue of data.issues) {
    const ticket = buildTicket(issue.number, data)
    const isForPerson = String(ticket.waitingOn ?? '').toLowerCase() === 'persona'
    if (isForPerson || isSet(ticket.waitingForHuman)) {
      const why = isSet(ticket.waitingForHuman) ? ticket.waitingForHuman : 'Espera a: Persona'
      items.push({ kind: 'issue', text: `#${issue.number} ${issue.title}: ${why}`, url: issue.url })
    }
  }
  return items
}

export function inboxLines(items) {
  return items.length
    ? items.map((item) => `${item.text}\n  ${item.url}`)
    : ['Nothing waits for you.']
}

function tryRun(io, command, args) {
  try {
    return io.run(command, args)
  } catch {
    return null
  }
}

// Returns what is wrong, each with the command that fixes it; empty when the identity is right.
export function checkIdentity(config, io) {
  const { commitEmail, account, repository } = config.github
  const problems = []
  const email = tryRun(io, 'git', ['config', 'user.email'])?.trim() ?? ''
  if (email !== commitEmail)
    problems.push(
      `git user.email is ${email ? `"${email}"` : 'not set'}, not the project's noreply. Fix: git config user.email "${commitEmail}" (docs/process/bootstrap.md)`,
    )
  if (io.env.GH_TOKEN) {
    // Only an installation token can list the installation's repositories.
    const repos = tryRun(io, 'gh', [
      'api',
      '/installation/repositories',
      '--jq',
      '[.repositories[].full_name]',
    ])
    if (!repos || !JSON.parse(repos).includes(repository))
      problems.push(
        `GH_TOKEN is not a token of the agents' App for ${repository}. Fix: GH_TOKEN=$(node scripts/github/app-token.mjs), or unset GH_TOKEN to use the gh login`,
      )
  } else {
    const login = tryRun(io, 'gh', ['api', 'user', '--jq', '.login'])?.trim()
    const dir = personGhConfigDir(io.env, homedir())
    if (login !== account)
      problems.push(
        `gh (config ${dir}) is logged in as ${login || 'nobody'}, not ${account}. Fix: log in as ${account} in that config, without switching the global gh account: ${loginCommand(dir)}`,
      )
  }
  return problems
}

// The same gh command for Git Bash and for PowerShell or cmd, against one config dir. On Windows the variable
// and gh.exe run in one cmd process: a gh shell function in the profile may set and remove GH_CONFIG_DIR itself.
export function ghCommand(dir, args) {
  const bash = `'${dir.replaceAll("'", "'\\''")}'`
  return `GH_CONFIG_DIR=${bash} gh ${args} (PowerShell or cmd: cmd /c "set GH_CONFIG_DIR=${dir}&& gh ${args}") (docs/process/bootstrap.md)`
}

function loginCommand(dir) {
  return ghCommand(dir, 'auth login -h github.com -s project')
}

// Read-only commands skip checkIdentity, so a config without a login surfaces as gh's own error.
export function withLoginHint(message, env) {
  if (env.GH_TOKEN || !message.includes('gh auth login')) return message
  return `${message}\nThe project gh config has no login. Fix: ${loginCommand(personGhConfigDir(env, homedir()))}`
}

export function boardFix(env = {}) {
  if (env.BOARD_TOKEN)
    return 'the board App needs the organization permission Projects: Read and write'
  if (env.GITHUB_ACTIONS) return 'the job has no BOARD_TOKEN from the board App (ADR-0069)'
  return env.GH_TOKEN
    ? "the agents' App needs the organization permission Projects: Read and write"
    : `gh needs the project scope in its config: ${ghCommand(personGhConfigDir(env, homedir()), 'auth refresh -s project')}`
}

// The person's gh keeps its own config, so the machine's global gh account is never used or switched.
// Same folder as the bootstrap's gh shell functions, so both share one login.
export function personGhConfigDir(env, home) {
  if (env.GH_TOKEN) return null
  return env.GH_CONFIG_DIR || join(home, '.config', 'gh-workampo')
}

// gh prefers GITHUB_TOKEN over the stored login, so another account's token would win in the person's path.
export function usePersonGh(env, home) {
  const dir = personGhConfigDir(env, home)
  if (!dir) return
  env.GH_CONFIG_DIR = dir
  delete env.GITHUB_TOKEN
}

export function assertIdentity(config, io) {
  const problems = checkIdentity(config, io)
  if (problems.length)
    throw new Error(`Refusing to act under this identity:\n- ${problems.join('\n- ')}`)
}

function ghJson(io, args) {
  return JSON.parse(io.run('gh', args))
}

function readBranches(io) {
  const branches = new Map()
  const refs = io
    .run('git', ['for-each-ref', '--format=%(refname:short)', 'refs/heads', 'refs/remotes/origin'])
    .split(/\r?\n/)
    .filter(Boolean)
  // Local refs come first, so they win over origin/.
  for (const ref of refs) {
    const branch = ref.replace(/^origin\//, '')
    const number = ticketFromBranch(branch)
    if (!number || branches.has(number)) continue
    branches.set(number, {
      branch,
      progress: tryRun(io, 'git', ['show', `${ref}:${PROGRESS_FILE}`]),
    })
  }
  return branches
}

export function collect(config, io) {
  const repository = config.github.repository
  const issues = ghJson(io, [
    'issue',
    'list',
    '--repo',
    repository,
    '--state',
    'open',
    '--limit',
    '500',
    '--json',
    'number,title,url,labels,body',
  ])
  const prs = ghJson(io, [
    'pr',
    'list',
    '--repo',
    repository,
    '--state',
    'open',
    '--limit',
    '200',
    '--json',
    'number,title,url,headRefName,isDraft,reviews,statusCheckRollup',
  ])
  let board = null
  try {
    const projectNumber = config.github.board.match(/\/projects\/(\d+)/)[1]
    board = ghJson(io, [
      'project',
      'item-list',
      projectNumber,
      '--owner',
      config.github.organization,
      '--format',
      'json',
      '--limit',
      '500',
    ]).items
  } catch {
    io.warn(`Board not read (${boardFix(io.env)}); using issues, PRs and branches only.`)
  }
  // One request per open issue and PR; fine at this project's size.
  for (const item of [...issues, ...prs]) item.comments = readComments(io, repository, item.number)
  return {
    repository,
    authors: trustedAuthors(config),
    issues,
    prs,
    board,
    branches: readBranches(io),
  }
}

function ensureIssue(number, data, io) {
  if (data.issues.some((issue) => issue.number === number)) return
  try {
    const issue = ghJson(io, [
      'issue',
      'view',
      String(number),
      '--repo',
      data.repository,
      '--json',
      'number,title,url,labels,body',
    ])
    issue.comments = readComments(io, data.repository, number)
    data.issues.push(issue)
  } catch {
    throw new Error(`Issue #${number} not found in ${data.repository}.`)
  }
}

export function help(io, config) {
  const lines = [HELP]
  const branch = tryRun(io, 'git', ['branch', '--show-current'])?.trim()
  const number = ticketFromBranch(branch)
  if (number) {
    let progress = io.exists(join(ROOT, PROGRESS_FILE))
      ? io.readFile(join(ROOT, PROGRESS_FILE))
      : null
    let source = ''
    if (!progress) {
      let comment = null
      try {
        const { number: pr } = JSON.parse(io.run('gh', ['pr', 'view', branch, '--json', 'number']))
        comment = latestProgress(
          readComments(io, config.github.repository, pr),
          trustedAuthors(config),
        )
      } catch {}
      progress = comment?.body ?? null
      if (comment) source = ` (${progressSource(comment, `the PR of ${branch}`)})`
    }
    const next = nextStep(progress)
    lines.push(
      '',
      next
        ? `Ticket #${number} · next: ${next}${source}`
        : `Ticket #${number}: no .work/PROGRESS.md or "Progress" comment with a Next line.`,
    )
  }
  io.log(lines.join('\n'))
}

export function status(args, config, io) {
  const data = collect(config, io)
  if (!args.numbers.length) {
    const tickets = activeTickets(data)
    if (args.json) return io.log(JSON.stringify({ boardRead: !!data.board, tickets }, null, 2))
    io.log(tickets.length ? tickets.map(statusLine).join('\n') : 'Nothing in progress.')
    return
  }
  for (const number of args.numbers) ensureIssue(number, data, io)
  const tickets = args.numbers.map((number) => buildTicket(number, data))
  if (args.json) return io.log(JSON.stringify({ boardRead: !!data.board, tickets }, null, 2))
  const body = (number) => data.issues.find((issue) => issue.number === number).body
  io.log(tickets.map((t) => statusDetail(t, body(t.number))).join('\n\n'))
}

export function inbox(args, config, io) {
  const data = collect(config, io)
  const runs = ghJson(io, [
    'api',
    `repos/${config.github.repository}/actions/runs?status=waiting`,
  ]).workflow_runs
  const items = buildInbox(data, runs, config.github.account)
  io.log(args.json ? JSON.stringify(items, null, 2) : inboxLines(items).join('\n'))
}

function refHas(io, branch, file) {
  return [branch, `origin/${branch}`].some(
    (ref) => tryRun(io, 'git', ['cat-file', '-e', `${ref}:${file}`]) !== null,
  )
}

export function resumeSummary(ticket, extraFiles) {
  const where = ticket.progressSource ?? PROGRESS_FILE
  const progress = ticket.progress
    ? ticket.progress
        .trim()
        .split(/\r?\n/)
        .map((line) => `   ${line}`)
        .join('\n')
    : '   (none found)'
  return [
    'Reading order (docs/procedures/progress.md):',
    '1. AGENTS.md',
    `2. ${where}:`,
    progress,
    `3. Issue #${ticket.number} ${ticket.title}: ${ticket.url}`,
    `4. ${extraFiles.length ? extraFiles.join(', ') : 'No .work/tasks.md or .work/plan.md on the branch'}`,
    '',
    `Continue from Next: ${ticket.next ?? '—'}`,
  ].join('\n')
}

export async function resume(args, config, io) {
  if (io.run('git', ['status', '--porcelain']).trim())
    throw new Error('There are uncommitted changes: commit or stash them before resuming.')
  const data = collect(config, io)
  let [number] = args.numbers
  if (!number) {
    const tickets = activeTickets(data)
    if (!tickets.length) return io.log('Nothing in progress to resume.')
    io.log(tickets.map(statusLine).join('\n'))
    if (!io.isInteractive) return io.log('\nRun: pnpm work resume <n>')
    number = parseIssueNumber(await io.prompt('Ticket to resume: '))
  }
  ensureIssue(number, data, io)
  const ticket = buildTicket(number, data)
  if (!ticket.branch) throw new Error(`#${number} has no branch yet: pnpm work start ${number}`)
  const current = io.run('git', ['branch', '--show-current']).trim()
  if (current !== ticket.branch) {
    if (args.dryRun) io.log(`Would run: git switch ${ticket.branch}`)
    else io.run('git', ['switch', ticket.branch])
  }
  const extraFiles = ['.work/tasks.md', '.work/plan.md'].filter((file) =>
    refHas(io, ticket.branch, file),
  )
  io.log(resumeSummary(ticket, extraFiles))
}

export function slugify(title) {
  const slug = title
    .normalize('NFD')
    .replace(/[̀-ͯ]/g, '')
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, '-')
    .replace(/^-|-$/g, '')
  const short = slug.length <= SLUG_MAX ? slug : slug.slice(0, SLUG_MAX + 1).replace(/-[^-]*$/, '')
  return short.slice(0, SLUG_MAX) || 'ticket'
}

const hasLabel = (issue, name) => (issue.labels ?? []).some((label) => label.name === name)

export function branchName(issue) {
  const prefix = hasLabel(issue, 'type:bug') ? 'bugfix' : 'feature'
  return `${prefix}/${issue.number}-${slugify(issue.title)}`
}

export function progressText({ number, slug, branch, parent, size, updated }) {
  const step = size === 'S' ? 'Build › Implement' : 'Define › Discover'
  const next =
    size === 'S'
      ? "implement the issue's checklist (docs/process/cycle.md)"
      : 'Discover: research the intent, then Specify (docs/process/cycle.md)'
  return `# Progress

${parent ? `PRD #${parent} · ` : ''}Ticket #${number} ${slug} · Branch: ${branch}
Step: ${step}
Done in this step: —
In progress: —
Next: ${next}
Waiting for human: —
Open questions: —
Updated: ${updated}
`
}

export function trailers(number, parent) {
  return [`Refs: #${number}`, parent && `PRD: #${parent}`].filter(Boolean).join('\n')
}

export function tagIssue(text, number) {
  return text.replaceAll(`@wip(#${number})`, `@issue(#${number})`)
}

export function prTitle(issue, title) {
  if (title) return title
  const type = hasLabel(issue, 'type:feature')
    ? 'feat'
    : hasLabel(issue, 'type:bug')
      ? 'fix'
      : 'chore'
  const subject = issue.title.trim().replace(/\.$/, '')
  return `${type}: ${subject[0].toLowerCase()}${subject.slice(1)}`
}

export function prLabels(issue) {
  return (issue.labels ?? [])
    .map((label) => label.name)
    .filter((name) => /^(type|area|size):/.test(name))
}

export function prBody({ number, parent, summary }) {
  // The heading is ours: a summary that starts with its own would show it twice.
  // Only the heading and the blank lines after it go: the first line's indentation stays.
  // A heading has at most 3 leading spaces; with 4 it is a line of a code block and stays.
  const text = summary
    ?.replace(/^(?:[ \t]*\r?\n)*[ ]{0,3}## Summary[ \t]*(\r?\n[ \t]*)*\r?\n/, '')
    .trimEnd()

  return `${parent ? `PRD #${parent}` : 'PRD: none'}\nTicket #${number}

## Summary

${text || '<!-- Filled by the agent: pnpm work pr --body-file <summary.md> -->'}
`
}

// Opening the PR is step 8 whatever step .work/PROGRESS.md was last left at.
export function progressComment(progress, tasks) {
  const table = (tasks ?? '').split(/\r?\n/).filter((line) => line.startsWith('|'))
  const atReview = progress
    .trim()
    .replace(/^Step: .*$/m, 'Step: Deliver › Pull request')
    .replace(
      /^Next: .*$/m,
      'Next: review rounds with pnpm work review <pr> --wait (docs/process/cycle.md#pr-review)',
    )

  return `${atReview}${table.length ? `\n\n## Tasks\n\n${table.join('\n')}` : ''}\n`
}

export function closeComment(learning) {
  return ['Closed as completed by `pnpm work close`.', learning && `Proposed learning: ${learning}`]
    .filter(Boolean)
    .join('\n\n')
}

const removalMessage = (number) => `chore: remove ticket ${number} temporaries before the PR`

function shown(arg) {
  return /[\s"']/.test(arg) ? JSON.stringify(arg) : arg
}

function actor(args, io) {
  return (command, commandArgs, options) => {
    if (!args.dryRun) return io.run(command, commandArgs, options)
    io.log(`Would run: ${[command, ...commandArgs].map(shown).join(' ')}`)
    if (options?.input) io.log(options.input)
    return ''
  }
}

function viewIssue(number, fields, config, io) {
  return ghJson(io, [
    'issue',
    'view',
    String(number),
    '--repo',
    config.github.repository,
    '--json',
    fields,
  ])
}

function parentOf(issue, config, io) {
  const fromApi = tryRun(io, 'gh', [
    'api',
    `repos/${config.github.repository}/issues/${issue.number}/parent`,
    '--jq',
    '.number',
  ])?.trim()
  if (fromApi) return Number(fromApi)
  const fromBody = (issue.body ?? '').match(/^PRD #(\d+)/m)
  return fromBody ? Number(fromBody[1]) : null
}

// The App token travels only in the environment of the push (GIT_CONFIG_*), never in argv,
// a remote, a log or an error message: argv is visible to every process on the machine.
export function pushEnv(token) {
  const basic = Buffer.from(`x-access-token:${token}`).toString('base64')
  return {
    GIT_CONFIG_COUNT: '1',
    GIT_CONFIG_KEY_0: 'http.https://github.com/.extraheader',
    GIT_CONFIG_VALUE_0: `AUTHORIZATION: basic ${basic}`,
  }
}

// A git call over HTTPS with the App token in its environment; its error never shows the token.
function gitWithToken(gitArgs, token, run) {
  const env = pushEnv(token)
  try {
    return run('git', gitArgs, { env })
  } catch (error) {
    const secrets = [token, env.GIT_CONFIG_VALUE_0.split(' ').at(-1)]
    throw new Error(secrets.reduce((text, s) => text.replaceAll(s, '***'), error.message))
  }
}

function push(branch, args, config, io) {
  const token = io.env.GH_TOKEN
  if (!token) return actor(args, io)('git', ['push', '-u', 'origin', branch])
  const url = `https://github.com/${config.github.repository}.git`
  if (args.dryRun)
    return io.log(`Would run: GIT_CONFIG_VALUE_0=<GH_TOKEN header> git push ${url} ${branch}`)
  gitWithToken(['push', url, branch], token, io.run)
}

// Workflows close tickets with github.token, which cannot edit an organization board: the card
// moves with BOARD_TOKEN, a token of the board-only App, when the job has one (ADR-0069).
function boardIo(io) {
  const token = io.env?.BOARD_TOKEN
  if (!token) return io
  const env = { ...io.env, GH_TOKEN: token }
  return { ...io, run: (command, args, options) => io.run(command, args, { ...options, env }) }
}

export function moveCard(issueUrl, column, args, config, io) {
  if (args.dryRun) return io.log(`Would move the board card to ${column}.`)
  const project = config.github.board.match(/\/projects\/(\d+)/)[1]
  const owner = ['--owner', config.github.organization, '--format', 'json']
  const board = boardIo(io)
  try {
    const projectId = ghJson(board, ['project', 'view', project, ...owner]).id
    const status = ghJson(board, ['project', 'field-list', project, ...owner]).fields.find(
      (field) => field.name === 'Status',
    )
    const option = status.options.find((o) => o.name === column)
    // item-add returns the existing item when the issue is already on the board.
    const item = ghJson(board, ['project', 'item-add', project, ...owner, '--url', issueUrl])
    board.run('gh', [
      'project',
      'item-edit',
      '--id',
      item.id,
      '--project-id',
      projectId,
      '--field-id',
      status.id,
      '--single-select-option-id',
      option.id,
    ])
    io.log(`Board card moved to ${column}.`)
  } catch {
    io.warn(
      `Board not updated (${boardFix(io.env)}). Set the card to ${column} by hand: ${config.github.board}`,
    )
  }
}

export function start(args, config, io) {
  assertIdentity(config, io)
  const [number] = args.numbers
  const act = actor(args, io)
  const issue = viewIssue(number, 'number,title,url,labels,body,state', config, io)
  if (issue.state !== 'OPEN') throw new Error(`#${number} is closed.`)
  const size = sizeOf(issue.labels)
  if (size === '?')
    throw new Error(
      `#${number} has no size: label: the person confirms size:S, size:M or size:L first (ADR-0052).`,
    )
  const parent = parentOf(issue, config, io)
  const existing = readBranches(io).get(number)?.branch
  const branch = existing ?? branchName(issue)
  const current = io.run('git', ['branch', '--show-current']).trim()
  if (current !== branch) {
    if (io.run('git', ['status', '--porcelain']).trim())
      throw new Error('There are uncommitted changes: commit or stash them before starting.')
    // Never gh issue develop: GitHub closes an issue whose linked branch is merged, before the
    // observation window that closes a ticket (ADR-0020).
    if (existing) act('git', ['switch', branch])
    else {
      const token = io.env.GH_TOKEN
      // The App works over HTTPS: origin is the person's SSH remote.
      const remote = token ? `https://github.com/${config.github.repository}.git` : 'origin'
      // Explicit refspecs: a narrowed remote.origin.fetch would leave origin/* stale.
      const fetch = (from, to) =>
        token
          ? gitWithToken(['fetch', remote, `${from}:${to}`], token, act)
          : act('git', ['fetch', remote, `${from}:${to}`])
      const ref = `refs/heads/${branch}`
      if (io.run('git', ['ls-remote', remote, ref]).trim()) {
        fetch(ref, `refs/remotes/origin/${branch}`)
        act('git', ['switch', branch])
      } else {
        fetch('refs/heads/master', 'refs/remotes/origin/master')
        // --no-track: the ticket branch must never pull from master; the person's push sets its upstream.
        act('git', ['switch', '--no-track', '-c', branch, 'origin/master'])
      }
    }
  }
  if (refHas(io, branch, PROGRESS_FILE)) io.log(`${PROGRESS_FILE} is already on ${branch}.`)
  else {
    const text = progressText({
      number,
      slug: branch.replace(/^[a-z]+\/\d+-/, ''),
      branch,
      parent,
      size,
      updated: io.now().toISOString().slice(0, 16).replace('T', ' '),
    })
    if (args.dryRun) io.log(`Would write ${PROGRESS_FILE}:\n${text}`)
    else io.writeFile(join(ROOT, PROGRESS_FILE), text)
    act('git', ['add', '--', PROGRESS_FILE])
    act('git', ['commit', '-m', `chore: start ticket ${number}\n\n${trailers(number, parent)}`])
  }
  moveCard(issue.url, size === 'S' ? 'Build' : 'Define', args, config, io)
  push(branch, args, config, io)
  io.log(`#${number} started on ${branch}.`)
}

// Once removed, the temporaries are read back from the commit before the removal, so a re-run
// after a failure still posts the "Plan" and "Progress" comments.
function readTemporaries(number, io) {
  const files = [PROGRESS_FILE, PLAN_FILE, TASKS_FILE]
  const isInHead = files.some(
    (file) => tryRun(io, 'git', ['cat-file', '-e', `HEAD:${file}`]) !== null,
  )
  const removal = isInHead
    ? null
    : tryRun(io, 'git', [
        'log',
        '-1',
        '--format=%H',
        '--fixed-strings',
        '--grep',
        removalMessage(number),
      ])?.trim()
  const ref = isInHead ? 'HEAD' : removal ? `${removal}^` : null
  const read = (file) => (ref ? tryRun(io, 'git', ['show', `${ref}:${file}`]) : null)
  return {
    isInHead,
    read,
    progress: read(PROGRESS_FILE),
    plan: read(PLAN_FILE),
    tasks: read(TASKS_FILE),
  }
}

function readSummary(path, saved, io) {
  try {
    return io.readFile(path)
  } catch (error) {
    const fromHistory = saved.read(path.replace(/\\/g, '/').replace(/^\.\//, ''))
    if (fromHistory === null) throw error
    return fromHistory
  }
}

function tagSpecs(number, args, io) {
  const changed = []
  // Recursive: a large domain becomes a folder of specs.
  for (const entry of io.list(join(ROOT, SPECS_DIR), { recursive: true })) {
    const name = entry.split(sep).join('/')
    if (!name.endsWith('.md')) continue
    const path = join(ROOT, SPECS_DIR, name)
    const text = io.readFile(path)
    const tagged = tagIssue(text, number)
    if (tagged === text) continue
    changed.push(`${SPECS_DIR}/${name}`)
    if (args.dryRun)
      io.log(`Would replace @wip(#${number}) with @issue(#${number}) in ${SPECS_DIR}/${name}`)
    else io.writeFile(path, tagged)
  }
  return changed
}

export function pr(args, config, io) {
  assertIdentity(config, io)
  const repo = config.github.repository
  const act = actor(args, io)
  const branch = io.run('git', ['branch', '--show-current']).trim()
  const number = ticketFromBranch(branch)
  if (!number) throw new Error(`"${branch}" is not a ticket branch: pnpm work resume <n> first.`)
  if (io.run('git', ['status', '--porcelain']).trim())
    throw new Error('There are uncommitted changes: commit or stash them before the PR.')
  const issue = viewIssue(number, 'number,title,url,labels,body', config, io)
  const parent = parentOf(issue, config, io)
  act('pnpm', ['check'], { isVisible: true })
  const saved = readTemporaries(number, io)
  // Before .work/ goes: the summary may live there, or only in history on a retry after the removal.
  const summary = args.bodyFile ? readSummary(args.bodyFile, saved, io) : null

  const specs = tagSpecs(number, args, io)
  if (saved.isInHead || specs.length) {
    if (saved.isInHead) act('git', ['rm', '-r', '-q', '--', '.work'])
    if (specs.length) act('git', ['add', '--', ...specs])
    act('git', ['commit', '-m', `${removalMessage(number)}\n\n${trailers(number, parent)}`])
  }
  push(branch, args, config, io)

  const [open] = ghJson(io, [
    'pr',
    'list',
    '--repo',
    repo,
    '--head',
    branch,
    '--state',
    'open',
    '--json',
    'url,number',
  ])
  if (open) io.log(`PR already open: ${open.url}`)
  else {
    const labels = prLabels(issue).flatMap((label) => ['--label', label])
    const url = act(
      'gh',
      [
        'pr',
        'create',
        '--repo',
        repo,
        '--base',
        'master',
        '--head',
        branch,
        '--title',
        prTitle(issue, args.title),
        '--body-file',
        '-',
        ...labels,
      ],
      { input: prBody({ number, parent, summary }) },
    )
    if (url) io.log(`PR opened: ${url.trim()}`)
  }

  const comments = open ? readComments(io, repo, open.number) : []
  const authors = trustedAuthors(config)
  const comment = (body) =>
    act('gh', ['pr', 'comment', branch, '--repo', repo, '--body-file', '-'], { input: body })
  if (saved.plan && !comments.some((c) => isHeadedBy(c, PLAN_HEADING, authors)))
    comment(`# Plan\n\n${saved.plan.trim()}\n`)
  if (saved.progress && !latestProgress(comments, authors))
    comment(progressComment(saved.progress, saved.tasks))
  moveCard(issue.url, 'Review', args, config, io)
}

export function close(args, config, io) {
  assertIdentity(config, io)
  const [number] = args.numbers
  const issue = viewIssue(number, 'number,url,state', config, io)
  if (issue.state === 'CLOSED') io.log(`#${number} is already closed.`)
  else
    actor(args, io)('gh', [
      'issue',
      'close',
      String(number),
      '--repo',
      config.github.repository,
      '--reason',
      'completed',
      '--comment',
      closeComment(args.learning),
    ])
  moveCard(issue.url, 'Done', args, config, io)
}

// Outside the repo but inside its parent folder, so the per-folder git identity still applies.
export function verifyDir(number) {
  return join(ROOT, '..', `workampo-verify-${number}`)
}

export function openCommand(platform, url) {
  if (platform === 'win32') return ['cmd', ['/c', 'start', '', url]]
  return [platform === 'darwin' ? 'open' : 'xdg-open', [url]]
}

export function stopHint(platform, pid) {
  return platform === 'win32' ? `taskkill /PID ${pid} /T /F` : `kill ${pid}`
}

// The verification package lives in the issue's "Work log" (ADR-0020); until it exists,
// the PR's "Progress" comment is the closest thing.
export function verificationList(issueComments, prComments, authors) {
  const workLog = (issueComments ?? []).findLast((c) => isHeadedBy(c, WORK_LOG_HEADING, authors))
  if (workLog)
    return `From the "Work log" comment by ${commentAuthor(workLog)}:\n\n${workLog.body.trim()}`
  const progress = latestProgress(prComments, authors)
  if (progress) return `${progressSource(progress, 'the PR')}:\n\n${progress.body.trim()}`
  return 'No "Work log" or "Progress" comment with a verification list yet.'
}

const SERVE_TRIES = 60

async function waitUntilServing(url, io) {
  for (let i = 0; i < SERVE_TRIES; i++) {
    if (await io.isServing(url)) return true
    await io.sleep(1000)
  }
  return false
}

// verify runs the branch's own install scripts, seed and app: none of them gets a credential.
// Blank, not removed, because run() and spawnDetached() merge env over process.env.
// shortcut: a deny list; an allow list would also cut the system variables pnpm and wrangler need on
// Windows. Case-insensitive because Windows variable names are.
const CREDENTIAL =
  /^(GH|GITHUB|BOARD|CLOUDFLARE|SENTRY|UPTIMEROBOT)_|TOKEN|SECRET|PASSWORD|PASSWD|CREDENTIAL|PRIVATE|_AUTH|_KEY$/i
export function withoutCredentials(env) {
  return Object.fromEntries(
    Object.keys(env)
      .filter((key) => CREDENTIAL.test(key))
      .map((key) => [key, '']),
  )
}

export async function verify(args, config, io) {
  const [number] = args.numbers
  const repo = config.github.repository
  const act = actor(args, io)
  const health = `${VERIFY_URL}/health`
  const branch = readBranches(io).get(number)?.branch
  if (!branch) throw new Error(`#${number} has no branch yet: pnpm work start ${number}`)
  if (!args.dryRun && (await io.isServing(health)))
    throw new Error(`Something already answers on ${VERIFY_URL}: stop it before verifying again.`)

  tryRun(io, 'git', ['fetch', 'origin', branch])
  const isPushed = tryRun(io, 'git', ['rev-parse', '--verify', '--quiet', `origin/${branch}`])
  const ref = isPushed ? `origin/${branch}` : branch
  const dir = verifyDir(number)
  // Detached, so the branch can stay checked out in the main working tree.
  if (io.exists(dir)) {
    // `git switch` carries local edits along, and the app would run them instead of the PR.
    if (io.run('git', ['-C', dir, 'status', '--porcelain', '--untracked-files=all']).trim())
      throw new Error(
        `${dir} has local changes: inspect them with git -C ${dir} status, then discard them or remove the worktree (git worktree remove --force ${dir}).`,
      )
    act('git', ['-C', dir, 'switch', '--detach', ref])
  } else act('git', ['worktree', 'add', '--detach', dir, ref])

  const apiDir = join(dir, 'apps', 'api')
  const wrangler = join(apiDir, WRANGLER)
  const persist = join(apiDir, VERIFY_PERSIST)
  const branchEnv = withoutCredentials(io.env)
  const visible = (cwd) => ({ cwd, isVisible: true, env: branchEnv })
  act('pnpm', ['install'], visible(dir))
  // The Worker serves the built SPA (ADR-0073), as in production.
  act('pnpm', ['--filter', '@workampo/web', 'build'], visible(dir))
  // --keep-data reuses the previous run's database only if its seed finished; otherwise it starts fresh.
  const seeded = join(persist, SEEDED_MARKER)
  const keepsData = Boolean(args.keepData) && io.exists(seeded)
  if (args.keepData && !keepsData)
    io.log('No complete database from a previous run: starting a fresh one.')

  if (keepsData) io.log(`Keeping ${persist}: only new migrations are applied, no seed.`)
  else if (args.dryRun) io.log(`Would remove ${persist}`)
  else io.remove(persist)

  for (const db of Object.values(LOCAL_DATABASES))
    applyMigrations({
      act,
      keepsData,
      args: [wrangler, 'd1', 'migrations', 'apply', db, '--local', '--persist-to', persist],
      options: visible(apiDir),
    })

  if (!keepsData) {
    act('node', [join('scripts', 'db', 'seed.mjs'), '--persist-to', persist], visible(dir))
    if (!args.dryRun)
      io.writeFile(
        seeded,
        `${new Date().toISOString()}
`,
      )
  }

  const dev = [wrangler, 'dev', '--local', '--ip', '127.0.0.1', '--port', '8787']
  dev.push('--persist-to', persist)
  const [openFile, openArgs] = openCommand(io.platform, health)
  if (args.dryRun) {
    io.log(`Would start in the background: ${['node', ...dev].map(shown).join(' ')}`)
    io.log(`Would run: ${[openFile, ...openArgs].map(shown).join(' ')}`)
  } else {
    const log = join(apiDir, VERIFY_LOG)
    const pid = io.spawnDetached('node', dev, { cwd: apiDir, log, env: branchEnv })
    if (!(await waitUntilServing(health, io))) {
      const hint = stopHint(io.platform, pid)
      const [stop, ...stopArgs] = hint.split(' ')
      const isStopped = tryRun(io, stop, stopArgs) !== null
      const notServing = `wrangler dev did not answer after ${SERVE_TRIES} tries 1 s apart`
      throw new Error(
        isStopped
          ? `${notServing} and was stopped: see ${log}`
          : `${notServing} and could not be stopped: stop process ${pid} with ${hint}; see ${log}`,
      )
    }
    io.log(`App running at ${VERIFY_URL} (log: ${log}).`)
    io.log(`Stop it with: ${stopHint(io.platform, pid)}`)
    if (tryRun(io, openFile, openArgs) === null) io.warn(`Open ${health} in the browser.`)
  }

  const [open] = ghJson(io, [
    'pr',
    'list',
    '--repo',
    repo,
    '--head',
    branch,
    '--state',
    'open',
    '--json',
    'number',
  ])
  const prComments = open ? readComments(io, repo, open.number) : []
  const list = verificationList(readComments(io, repo, number), prComments, trustedAuthors(config))
  io.log(`\n${list}`)
}

function applyMigrations({ act, keepsData, args, options }) {
  try {
    act('node', args, options)
  } catch (error) {
    if (!keepsData) throw error
    throw new Error(
      `A new migration does not apply to the kept data (${error.message}). Run pnpm work verify without --keep-data to start from a fresh database.`,
    )
  }
}

// Started through `pnpm work`, npm_execpath is pnpm's own script: Node cannot spawn pnpm.cmd without a shell.
function run(command, args, { input, isVisible = false, cwd = ROOT, env } = {}) {
  const [file, fileArgs] =
    command === 'pnpm' && process.env.npm_execpath
      ? [process.execPath, [process.env.npm_execpath, ...args]]
      : [command, args]
  const output = isVisible ? 'inherit' : 'pipe'
  try {
    return execFileSync(file, fileArgs, {
      cwd,
      env: env && { ...process.env, ...env },
      encoding: 'utf8',
      input,
      stdio: [input == null ? 'ignore' : 'pipe', output, output],
      maxBuffer: 64 * 1024 * 1024,
    })
  } catch (error) {
    const detail = error.stderr?.toString().trim() || error.message
    throw new Error(`${command} ${args[0]} failed: ${detail}`)
  }
}

async function prompt(question) {
  const rl = createInterface({ input: process.stdin, output: process.stdout })
  try {
    return await rl.question(question)
  } finally {
    rl.close()
  }
}

if (process.argv[1] && import.meta.url === pathToFileURL(process.argv[1]).href) {
  usePersonGh(process.env, homedir())
  const io = {
    run,
    prompt,
    env: process.env,
    exists: existsSync,
    readFile: (path) => readFileSync(path, 'utf8'),
    writeFile: (path, text) => {
      mkdirSync(dirname(path), { recursive: true })
      writeFileSync(path, text)
    },
    list: readdirSync,
    remove: (path) => rmSync(path, { recursive: true, force: true }),
    platform: process.platform,
    isServing: (url) =>
      fetch(url, { signal: AbortSignal.timeout(2000) }).then(
        (response) => response.ok,
        () => false,
      ),
    sleep: (ms) => new Promise((done) => setTimeout(done, ms)),
    spawnDetached: (command, commandArgs, { cwd, log, env }) => {
      mkdirSync(dirname(log), { recursive: true })
      const out = openSync(log, 'a')
      const child = spawn(command, commandArgs, {
        cwd,
        env: env && { ...process.env, ...env },
        detached: true,
        stdio: ['ignore', out, out],
      })
      child.unref()
      return child.pid
    },
    now: () => new Date(),
    log: console.log,
    warn: console.error,
    isInteractive: process.stdin.isTTY && process.stdout.isTTY,
  }
  try {
    const args = parseArgs(process.argv.slice(2))
    const config = parse(readFileSync(join(ROOT, 'project.yaml'), 'utf8'))
    const commands = {
      help: () => help(io, config),
      status,
      inbox,
      resume,
      start,
      pr,
      close,
      verify,
      review: (args, config, io) => {
        if (args.reply) assertIdentity(config, io)
        return review(args, config, io)
      },
    }
    await commands[args.command](args, config, io)
  } catch (error) {
    console.error(withLoginHint(error.message, process.env))
    process.exit(1)
  }
}
