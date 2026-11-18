// Ticket cycle commands (ADR-0052): node scripts/work/work.mjs [command] [args]
// gh and git run as child processes with argument arrays; tokens only travel through the environment.
import { execFileSync } from 'node:child_process'
import { existsSync, readFileSync } from 'node:fs'
import { join } from 'node:path'
import { createInterface } from 'node:readline/promises'
import { fileURLToPath, pathToFileURL } from 'node:url'
import { parse } from 'yaml'

const ROOT = fileURLToPath(new URL('../../', import.meta.url))
const BRANCH_TICKET = /^(?:feature|bugfix|hotfix)\/(\d+)-/
const ACTIVE_COLUMNS = ['Define', 'Build', 'Review']
const EMPTY_VALUES = ['', '—', '-']
const COMMANDS = ['help', 'status', 'inbox', 'resume']
const PROGRESS_FILE = '.work/PROGRESS.md'

export const HELP = `Usage: pnpm work <command> [args]

  status [n…] [--json]    What is in progress; with numbers, the detail of those tickets
  inbox [--json]          Only what waits for the person, with links
  resume [n] [--dry-run]  Switch to the ticket's branch and print where to continue

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
  for (const arg of rest) {
    if (arg === '--json') args.json = true
    else if (arg === '--dry-run') args.dryRun = true
    else if (arg.startsWith('-')) throw new Error(`Unknown option "${arg}".\n\n${HELP}`)
    else args.numbers.push(parseIssueNumber(arg))
  }
  if (command === 'resume' && args.numbers.length > 1)
    throw new Error('resume takes at most one issue number.')
  if (command === 'inbox' && args.numbers.length) throw new Error('inbox takes no issue numbers.')
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

export function latestProgress(comments = []) {
  const bodies = comments.map((comment) => comment.body ?? '')
  return bodies.findLast((body) => /^\s*#{1,6}\s*Progress\s*$/m.test(body.split('\n')[0])) ?? null
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
  const progressText =
    (pr && latestProgress(pr.comments)) ?? branch?.progress ?? latestProgress(issue?.comments)
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
    if (login !== account)
      problems.push(
        `gh is logged in as ${login || 'nobody'}, not ${account}. Fix: gh auth switch --user ${account} (or gh auth login)`,
      )
  }
  return problems
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
    'number,title,url,labels,body,comments',
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
    'number,title,url,headRefName,isDraft,reviews,comments,statusCheckRollup',
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
    io.warn(
      'Board not read (gh needs the project scope: gh auth refresh -s project); using issues, PRs and branches only.',
    )
  }
  return { repository, issues, prs, board, branches: readBranches(io) }
}

function ensureIssue(number, data, io) {
  if (data.issues.some((issue) => issue.number === number)) return
  try {
    data.issues.push(
      ghJson(io, [
        'issue',
        'view',
        String(number),
        '--repo',
        data.repository,
        '--json',
        'number,title,url,labels,body,comments',
      ]),
    )
  } catch {
    throw new Error(`Issue #${number} not found in ${data.repository}.`)
  }
}

export function help(io) {
  const lines = [HELP]
  const branch = tryRun(io, 'git', ['branch', '--show-current'])?.trim()
  const number = ticketFromBranch(branch)
  if (number) {
    let progress = io.exists(join(ROOT, PROGRESS_FILE))
      ? io.readFile(join(ROOT, PROGRESS_FILE))
      : null
    if (!progress) {
      const pr = tryRun(io, 'gh', ['pr', 'view', branch, '--json', 'comments'])
      progress = pr ? latestProgress(JSON.parse(pr).comments) : null
    }
    const next = nextStep(progress)
    lines.push(
      '',
      next
        ? `Ticket #${number} · next: ${next}`
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
  const where = ticket.pr ? `"Progress" comment of PR #${ticket.pr.number}` : PROGRESS_FILE
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

function run(command, args) {
  try {
    return execFileSync(command, args, {
      cwd: ROOT,
      encoding: 'utf8',
      stdio: ['ignore', 'pipe', 'pipe'],
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
  const io = {
    run,
    prompt,
    env: process.env,
    exists: existsSync,
    readFile: (path) => readFileSync(path, 'utf8'),
    log: console.log,
    warn: console.error,
    isInteractive: process.stdin.isTTY && process.stdout.isTTY,
  }
  try {
    const args = parseArgs(process.argv.slice(2))
    const config = parse(readFileSync(join(ROOT, 'project.yaml'), 'utf8'))
    const commands = { help: () => help(io), status, inbox, resume }
    await commands[args.command](args, config, io)
  } catch (error) {
    console.error(error.message)
    process.exit(1)
  }
}
