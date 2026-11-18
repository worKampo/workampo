// Ticket cycle commands (ADR-0052): node scripts/work/work.mjs [command] [args]
// gh and git run as child processes with argument arrays; tokens only travel through the environment.
import { execFileSync } from 'node:child_process'
import { existsSync, mkdirSync, readdirSync, readFileSync, writeFileSync } from 'node:fs'
import { dirname, join } from 'node:path'
import { createInterface } from 'node:readline/promises'
import { fileURLToPath, pathToFileURL } from 'node:url'
import { parse } from 'yaml'

const ROOT = fileURLToPath(new URL('../../', import.meta.url))
const BRANCH_TICKET = /^(?:feature|bugfix|hotfix)\/(\d+)-/
const ACTIVE_COLUMNS = ['Define', 'Build', 'Review']
const EMPTY_VALUES = ['', '—', '-']
const COMMANDS = ['help', 'status', 'inbox', 'resume', 'start', 'pr', 'close']
const VALUE_OPTIONS = { '--title': 'title', '--body-file': 'bodyFile', '--learning': 'learning' }
const PROGRESS_FILE = '.work/PROGRESS.md'
const PLAN_FILE = '.work/plan.md'
const TASKS_FILE = '.work/tasks.md'
const SPECS_DIR = 'docs/domains'
const SLUG_MAX = 40

export const HELP = `Usage: pnpm work <command> [args]

  status [n…] [--json]    What is in progress; with numbers, the detail of those tickets
  inbox [--json]          Only what waits for the person, with links
  resume [n] [--dry-run]  Switch to the ticket's branch and print where to continue
  start <n> [--dry-run]   Create the ticket's branch and .work/PROGRESS.md, move the card
  pr [--title "<title>"] [--body-file <summary.md>] [--dry-run]
                          On a ticket branch: pnpm check, @wip to @issue, remove .work/, push, open the PR
  close <n> [--learning "<text>"] [--dry-run]
                          Close the issue as completed and move the card to Done

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
    if (VALUE_OPTIONS[arg]) {
      const value = rest[++i]
      if (value === undefined) throw new Error(`${arg} needs a value.`)
      args[VALUE_OPTIONS[arg]] = value
    } else if (arg === '--json') args.json = true
    else if (arg === '--dry-run') args.dryRun = true
    else if (arg.startsWith('-')) throw new Error(`Unknown option "${arg}".\n\n${HELP}`)
    else args.numbers.push(parseIssueNumber(arg))
  }
  if (command === 'resume' && args.numbers.length > 1)
    throw new Error('resume takes at most one issue number.')
  if (['inbox', 'pr'].includes(command) && args.numbers.length)
    throw new Error(`${command} takes no issue numbers.`)
  if (['start', 'close'].includes(command) && args.numbers.length !== 1)
    throw new Error(`${command} takes one issue number.`)
  const allowed = { pr: ['title', 'bodyFile'], close: ['learning'] }[command] ?? []
  for (const [option, key] of Object.entries(VALUE_OPTIONS))
    if (key in args && !allowed.includes(key)) throw new Error(`${command} takes no ${option}.`)
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
    io.warn(
      'Board not read (gh needs the project scope: gh auth refresh -s project); using issues, PRs and branches only.',
    )
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
  return `${parent ? `PRD #${parent}\n` : ''}Ticket #${number}

## Summary

${summary?.trim() || '<!-- Filled by the agent: pnpm work pr --body-file <summary.md> -->'}
`
}

export function progressComment(progress, tasks) {
  const table = (tasks ?? '').split(/\r?\n/).filter((line) => line.startsWith('|'))
  return `${progress.trim()}${table.length ? `\n\n## Tasks\n\n${table.join('\n')}` : ''}\n`
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

// The App token goes only into the push URL, never into a remote, a log or an error message.
function push(branch, args, config, io) {
  const token = io.env.GH_TOKEN
  const target = token
    ? [
        `https://x-access-token:${args.dryRun ? '<GH_TOKEN>' : token}@github.com/${config.github.repository}.git`,
        branch,
      ]
    : ['-u', 'origin', branch]
  try {
    actor(args, io)('git', ['push', ...target])
  } catch (error) {
    throw new Error(token ? error.message.replaceAll(token, '***') : error.message)
  }
}

export function moveCard(issueUrl, column, args, config, io) {
  if (args.dryRun) return io.log(`Would move the board card to ${column}.`)
  const project = config.github.board.match(/\/projects\/(\d+)/)[1]
  const owner = ['--owner', config.github.organization, '--format', 'json']
  try {
    const projectId = ghJson(io, ['project', 'view', project, ...owner]).id
    const status = ghJson(io, ['project', 'field-list', project, ...owner]).fields.find(
      (field) => field.name === 'Status',
    )
    const option = status.options.find((o) => o.name === column)
    // item-add returns the existing item when the issue is already on the board.
    const item = ghJson(io, ['project', 'item-add', project, ...owner, '--url', issueUrl])
    io.run('gh', [
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
      `Board not updated (gh needs the project scope: gh auth refresh -s project). Set the card to ${column} by hand: ${config.github.board}`,
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
    if (existing) act('git', ['switch', branch])
    else
      act('gh', [
        'issue',
        'develop',
        String(number),
        '--repo',
        config.github.repository,
        '--name',
        branch,
        '--base',
        'master',
        '--checkout',
      ])
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
  return { isInHead, progress: read(PROGRESS_FILE), plan: read(PLAN_FILE), tasks: read(TASKS_FILE) }
}

function tagSpecs(number, args, io) {
  const changed = []
  for (const name of io.list(join(ROOT, SPECS_DIR)).filter((n) => n.endsWith('.md'))) {
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
    const summary = args.bodyFile ? io.readFile(args.bodyFile) : null
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

// Started through `pnpm work`, npm_execpath is pnpm's own script: Node cannot spawn pnpm.cmd without a shell.
function run(command, args, { input, isVisible = false } = {}) {
  const [file, fileArgs] =
    command === 'pnpm' && process.env.npm_execpath
      ? [process.execPath, [process.env.npm_execpath, ...args]]
      : [command, args]
  const output = isVisible ? 'inherit' : 'pipe'
  try {
    return execFileSync(file, fileArgs, {
      cwd: ROOT,
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
    now: () => new Date(),
    log: console.log,
    warn: console.error,
    isInteractive: process.stdin.isTTY && process.stdout.isTTY,
  }
  try {
    const args = parseArgs(process.argv.slice(2))
    const config = parse(readFileSync(join(ROOT, 'project.yaml'), 'utf8'))
    const commands = { help: () => help(io, config), status, inbox, resume, start, pr, close }
    await commands[args.command](args, config, io)
  } catch (error) {
    console.error(error.message)
    process.exit(1)
  }
}
