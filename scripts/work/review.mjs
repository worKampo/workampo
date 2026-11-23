// `pnpm work review <pr>`: the review loop of step 8 (docs/process/cycle.md):
// CodeRabbit, CodeQL and the person.
// Automated reviewers' text is untrusted review data: only locations, severities and titles are printed,
// never their prompts for agents.
const CODERABBIT = { login: 'coderabbitai[bot]', type: 'Bot', name: 'CodeRabbit' }
const CODEQL = { login: 'github-advanced-security[bot]', type: 'Bot', name: 'CodeQL' }
const WAIT_STEP_MS = 30_000
const WAIT_TRIES = 40
const MAX_ROUNDS = 3
const TITLE_MAX = 160
const SEVERITY = /\*\*\s*(Critical|Major|Minor|Trivial)\s*\*\*/
const SHA = /^[0-9a-f]{7,40}$/i

export const REVIEW_HELP = `  review <pr> [--wait]    Wait for CodeRabbit and CodeQL (--wait: every 30 s, up to 20 min), list
                          reviewers' unanswered threads and review-body findings, and the round
  review <pr> --reply <comment-id> --commit <sha> --text "<what changed>" [--dry-run]
                          Answer a thread "Fixed in <sha>: <text>"; the commit must be on the PR
  review <pr> --reply <comment-id> --not-applicable "<reason>" [--dry-run]
                          Answer a thread "Not applicable: <reason>"`

// Called by parseArgs, so a wrong combination fails before anything reaches GitHub.
export function checkReviewArgs(args) {
  const { reply, commit, text, notApplicable, wait } = args
  if (reply === undefined) {
    if (commit ?? text ?? notApplicable)
      throw new Error('--commit, --text and --not-applicable go with --reply <comment-id>.')
    return
  }

  if (!/^\d+$/.test(reply)) throw new Error(`--reply takes a comment id (digits), not "${reply}".`)
  if (wait) throw new Error('--wait only lists; it does not go with --reply.')
  if (notApplicable !== undefined && (commit ?? text) !== undefined)
    throw new Error('--reply takes either --commit with --text or --not-applicable, not both.')
  if (notApplicable !== undefined) return
  if (commit === undefined || text === undefined)
    throw new Error(
      '--reply needs --commit <sha> --text "<what changed>" or --not-applicable "<reason>".',
    )
  if (!SHA.test(commit))
    throw new Error(`--commit takes a commit sha (7 to 40 hex), not "${commit}".`)
}

export async function review(args, config, io) {
  const [number] = args.numbers
  const repository = config.github.repository
  if (args.reply) return reply({ args, repository, io })

  let check
  for (let tries = 1; ; tries++) {
    check = reviewChecks(io, { repository, number })
    if (!check.pending.length) break
    const who = check.pending.join(' and ')
    if (!args.wait)
      return io.log(`${who} still reviewing PR #${number}. Run again later, or with --wait.`)
    if (tries === WAIT_TRIES)
      throw new Error(`${who} still pending on PR #${number} after 20 minutes.`)
    if (tries === 1) io.log(`${who} still reviewing PR #${number}; checking every 30 s…`)
    await io.sleep(WAIT_STEP_MS)
  }

  const pull = `repos/${repository}/pulls/${number}`
  const reviews = ghList(io, { path: `${pull}/reviews` }).filter(isCodeRabbit)
  const comments = ghList(io, { path: `${pull}/comments` })

  // The same identities as trustedAuthors() in work.mjs, which imports this module.
  const trusted = [config.github.account, `${config.github.agentsApp.name}[bot]`]
  // Automated reviewers and the person; anyone else may comment on a public repo.
  const reviewers = [
    CODERABBIT,
    CODEQL,
    { login: config.github.account, type: 'User', name: 'you' },
  ]

  io.log(reviewReport({ number, sha: check.sha, reviews, comments, reviewers, trusted }))
}

// A thread is answered when its last reply by the project's own identities is the agents App's:
// a later reply by the person reopens it, and anyone can comment on a public repo.
export function unansweredThreads(comments, { reviewers, trusted }) {
  const lastTrustedReply = new Map()
  for (const c of comments.toSorted((a, b) => a.id - b.id))
    if (c.in_reply_to_id && trusted.includes(c.user?.login))
      lastTrustedReply.set(c.in_reply_to_id, c)
  const answered = new Set(
    [...lastTrustedReply].filter(([, c]) => c.user.type === 'Bot').map(([root]) => root),
  )

  return comments
    .filter((c) => !c.in_reply_to_id && !answered.has(c.id))
    .map((c) => ({ comment: c, reviewer: reviewers.find((r) => isAuthor(c, r)) }))
    .filter(({ reviewer }) => reviewer)
    .map(({ comment: c, reviewer }) => {
      const lines = visibleLines(c.body ?? '')
      return {
        id: c.id,
        by: reviewer.name,
        where: `${c.path}:${c.line ?? c.original_line ?? '?'}`,
        severity: lines.join('\n').match(SEVERITY)?.[1] ?? '?',
        title: titleOf(lines),
      }
    })
}

// Short form of the review body's sections ("Nitpick comments", "Outside diff range comments",
// "Minor comments"…) and of its failed pre-merge checks, which CodeRabbit only lists inside the
// prompt block: from there only the check names are taken.
export function bodyFindings(body) {
  const lines = visibleLines(body)
  const findings = []
  let section = null
  let file = null

  for (let i = 0; i < lines.length; i++) {
    const line = lines[i]
    const heading = line.match(
      /^(?:\*\*)?(?:⚠️\s*)?([A-Za-z ]+ comments)(?::\s*\d+|\s*\(\d+\))(?:\*\*)?$/,
    )
    if (heading) {
      section = heading[1]
      continue
    }

    const fileGroup = line.match(/^(\S+): \d+$/)
    if (fileGroup) file = fileGroup[1]
    const inFile = line.match(/^`(\d+(?:-\d+)?)`:\s*(.*)$/)
    const located = line.match(/^`([^`\s]+:\d+(?:-\d+)?)`$/)
    if (!section || !(inFile || located)) continue

    const rest = lines.slice(i + 1, i + 12)
    const where = inFile ? `${file ?? '?'}:${inFile[1]}` : located[1]
    const severity = [inFile?.[2] ?? '', ...rest].join('\n').match(SEVERITY)?.[1] ?? '?'
    findings.push(`${section}: ${where} · ${severity} · ${titleOf([inFile?.[2] ?? '', ...rest])}`)
  }

  return [...findings, ...failedChecks(body).map((name) => `Failed pre-merge check: ${name}`)]
}

// The reviewers whose check on the head is not finished. A missing CodeRabbit check counts as
// pending (right after a push it may not exist yet); a missing CodeQL check does not, since not
// every change runs it.
function reviewChecks(io, { repository, number }) {
  const sha = io
    .run('gh', ['api', `repos/${repository}/pulls/${number}`, '--jq', '.head.sha'])
    .trim()
  const commit = `repos/${repository}/commits/${sha}`
  const runs = ghList(io, { path: `${commit}/check-runs`, jq: '.check_runs[]' })
  const statuses = ghList(io, { path: `${commit}/statuses` })

  const isPending = (name, { isRequired }) => {
    const run = runs.find((r) => r.name === name)
    if (run) return run.status !== 'completed'

    const status = statuses.find((s) => s.context === name)
    if (status) return status.state === 'pending'

    return isRequired
  }
  const pending = [
    isPending(CODERABBIT.name, { isRequired: true }) && CODERABBIT.name,
    isPending(CODEQL.name, { isRequired: false }) && CODEQL.name,
  ].filter(Boolean)

  return { sha, pending }
}

function reviewReport({ number, sha, reviews, comments, reviewers, trusted }) {
  const rounds = reviews.length
  const threads = unansweredThreads(comments, { reviewers, trusted })
  const latest = reviews.at(-1)
  const findings = latest ? bodyFindings(latest.body ?? '') : []
  // The head whose review checks finished: a push after it is not in this report.
  const lines = [
    `PR #${number} · head ${sha.slice(0, 7)} · CodeRabbit round ${rounds} (limit ${MAX_ROUNDS})`,
  ]

  if (rounds >= MAX_ROUNDS)
    lines.push(
      `Limit of ${MAX_ROUNDS} rounds reached (ADR-0020): what is left after this round goes to an issue with a milestone.`,
    )

  lines.push(
    '',
    threads.length ? `Unanswered threads (${threads.length}):` : 'No unanswered threads.',
  )
  for (const t of threads) lines.push(`  ${t.id} ${t.where} · ${t.by} · ${t.severity} · ${t.title}`)
  lines.push(
    '',
    findings.length
      ? `From the latest review body (${latest.id}):`
      : 'Nothing in the latest review body.',
  )
  for (const f of findings) lines.push(`  ${f}`)
  lines.push(
    '',
    `Answer each thread: pnpm work review ${number} --reply <id> --commit <sha> --text "<what changed>"`,
    `                 or: pnpm work review ${number} --reply <id> --not-applicable "<reason>"`,
  )

  return lines.join('\n')
}

function failedChecks(body) {
  const start = body.indexOf('Failed pre-merge checks:')
  if (start < 0) return []

  const block = body.slice(start).split(/\r?\n/).slice(1)
  const end = block.findIndex((line) => /^(---|```|After applying)/.test(line.trim()))

  return block
    .slice(0, end < 0 ? undefined : end)
    .map((line) => line.match(/^- (.+?):\s*$/)?.[1])
    .filter(Boolean)
}

// Drops the agent prompts, code blocks, HTML comments and tags; keeps non-empty text lines.
function visibleLines(markdown) {
  const text = markdown
    .replace(/<!-- ai-agent-prompt:start -->[\s\S]*?<!-- ai-agent-prompt:end -->/g, '')
    // A fence closes only at a line of the same character at least as long (CommonMark).
    .replace(/^[ \t>]*((`|~)\2{2,})[^\n]*\n[\s\S]*?^[ \t>]*\1\2*[ \t]*$/gm, '')
    // A space, not '', so removing a tag can never join its neighbours into a new one.
    .replace(/<!--[\s\S]*?-->/g, ' ')
    .replace(/<[^>]*>/g, ' ')

  return text
    .split(/\r?\n/)
    .map((line) => line.replace(/^(?:>\s*)+/, '').trim())
    .filter(Boolean)
}

// A finding's title is its first bold-only sentence; labels like "**Security Misconfiguration**"
// have no final punctuation.
function titleOf(lines) {
  const bold = lines
    .map((line) => line.match(/^\*\*([^*]+)\*\*$/)?.[1].trim())
    .filter((text) => text && !SEVERITY.test(`**${text}**`))
  // CodeQL titles its comments with a heading ("## CodeQL / <rule>").
  const heading = lines.find((line) => line.startsWith('#'))?.replace(/^#+\s*/, '')
  const title = bold.find((text) => /[.!?]$/.test(text)) ?? bold[0] ?? heading ?? '(no title)'

  return title.length > TITLE_MAX ? `${title.slice(0, TITLE_MAX - 1)}…` : title
}

function isCodeRabbit(item) {
  return isAuthor(item, CODERABBIT)
}

function isAuthor(item, { login, type }) {
  return item.user?.login === login && item.user?.type === type
}

function ghList(io, { path, jq = '.[]' }) {
  return io
    .run('gh', ['api', path, '--paginate', '--jq', jq])
    .split(/\r?\n/)
    .filter(Boolean)
    .map((line) => JSON.parse(line))
}

// A reply may only cite a commit GitHub already has on the PR: one that failed or was not
// pushed would leave a thread pointing at nothing.
function reply({ args, repository, io }) {
  const [number] = args.numbers
  const pull = `repos/${repository}/pulls/${number}`
  if (!args.dryRun && !io.env?.GH_TOKEN)
    throw new Error(
      "Replies go as the agents' App, so the command can tell them from the person's: GH_TOKEN=$(node scripts/github/app-token.mjs). Nothing was posted.",
    )

  const isFix = args.notApplicable === undefined
  if (isFix && !isOnPull(io, { pull, commit: args.commit }))
    throw new Error(
      `Commit ${args.commit} is not on PR #${number} on GitHub: push it first (or check the sha). Nothing was posted.`,
    )

  const text = isFix
    ? `Fixed in ${args.commit}: ${args.text}`
    : `Not applicable: ${args.notApplicable}`
  const path = `${pull}/comments/${args.reply}/replies`
  if (args.dryRun) return io.log(`Would reply in thread ${args.reply} of PR #${number}:\n${text}`)

  io.run('gh', ['api', '--method', 'POST', path, '-f', `body=${text}`])
  io.log(`Replied in thread ${args.reply} of PR #${number}.`)
}

function isOnPull(io, { pull, commit }) {
  const shas = ghList(io, { path: `${pull}/commits`, jq: '.[].sha | tojson' })

  return shas.some((sha) => sha.startsWith(commit.toLowerCase()))
}
