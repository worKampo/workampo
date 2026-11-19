// Judges the 24-hour observation window of each prod deploy and closes its tickets when clean.
// Usage: check.mjs [--dry-run]
import { execFileSync } from 'node:child_process'
import { readFileSync } from 'node:fs'
import { join } from 'node:path'
import { fileURLToPath, pathToFileURL } from 'node:url'
import { parse } from 'yaml'
import { messagesLogArgs, parseRefs } from '../smoke/verification-comment.mjs'
import { closeComment, moveCard, readComments, trustedAuthors } from '../work/work.mjs'

const ROOT = fileURLToPath(new URL('../../', import.meta.url))
const WINDOW_MS = 24 * 60 * 60 * 1000
const MIN_UPTIME = 99.9
const UPTIMEROBOT_UP = 2
const TIMEOUT_MS = 15_000

const MARKER_PREFIX = '<!-- observation-window:'
export const marker = (sha) => `${MARKER_PREFIX}${sha} -->`

export function successTime(statuses) {
  const times = statuses.filter((s) => s.state === 'success').map((s) => s.created_at)
  return times.length ? times.sort()[0] : null
}

// deploys: [{ sha, createdAt, deployedAt | null }]; deployedAt is the time of the success status.
export function pendingDeploys(deploys, now) {
  const succeeded = deploys
    .filter((d) => d.deployedAt)
    .sort((a, b) => a.deployedAt.localeCompare(b.deployedAt))
  const pending = []
  const seen = new Set()
  let from = null
  for (const deploy of succeeded) {
    // A redeploy of the same SHA keeps the window of its first deploy.
    if (seen.has(deploy.sha)) continue
    seen.add(deploy.sha)
    if (Date.parse(deploy.deployedAt) + WINDOW_MS <= now.getTime())
      pending.push({
        sha: deploy.sha,
        deployedAt: deploy.deployedAt,
        from,
        newerShas: deploys.filter((d) => d.createdAt > deploy.deployedAt).map((d) => d.sha),
      })
    from = deploy.sha
  }
  return pending
}

export function observationAuthors(config) {
  // Comments posted by this workflow with the job's token.
  return [...trustedAuthors(config), { login: 'github-actions[bot]', type: 'Bot' }]
}

const CLEAN_HEADING = '## Observation window clean'

const isClean = (verdict) => verdict.body.startsWith(CLEAN_HEADING)

// 'judge', 'close' (a clean verdict whose close failed: retried) or 'skip'. events: the issue's
// timeline events. A reopen or a verdict needing the person after the clean one makes the
// ticket hers, so it is not closed again; a reopen before the verdict does not.
export function ticketAction(issue, comments, sha, authors, events = []) {
  if (issue.state !== 'open') return 'skip'
  const verdicts = comments.filter(
    (c) =>
      (c.body ?? '').includes(MARKER_PREFIX) &&
      authors.some((a) => a.login === c.user?.login && a.type === c.user?.type),
  )
  const verdict = verdicts.find((c) => c.body.includes(marker(sha)))
  if (!verdict) return 'judge'
  if (!isClean(verdict)) return 'skip'
  const isLater = (time) => time > verdict.created_at
  if (verdicts.some((c) => isLater(c.created_at) && !isClean(c))) return 'skip'
  if (events.some((e) => e.event === 'reopened' && isLater(e.created_at))) return 'skip'
  return 'close'
}

const notChecked = (variable) => ({ ok: false, text: `not checked: ${variable} is not set` })

// Only ids and links: Sentry titles can carry user data, and the issue is public.
export function sentrySignal(result, sha) {
  if (result.missing) return notChecked(result.missing)
  if (result.error) return { ok: false, text: `could not be read: ${result.error}` }
  if (!result.issues.length) return { ok: true, text: `no new issues first seen in ${sha} in prod` }
  const list = result.issues.map((i) => `${i.shortId} ${i.permalink}`).join(', ')
  return { ok: false, text: `${result.issues.length} new issue(s) first seen in ${sha}: ${list}` }
}

export function uptimeSignal(result, healthUrl) {
  if (result.missing) return notChecked(result.missing)
  if (result.error) return { ok: false, text: `could not be read: ${result.error}` }
  // UptimeRobot error objects can echo request fields (the API key among them): keep only a safe type.
  if (result.response.stat !== 'ok') {
    const type = String(result.response.error?.type ?? 'unknown').replace(/[^a-z_]/gi, '')
    return { ok: false, text: `could not be read (UptimeRobot error type: ${type || 'unknown'})` }
  }
  const target = healthUrl.replace(/\/+$/, '')
  const monitor = (result.response.monitors ?? []).find(
    (m) => (m.url ?? '').replace(/\/+$/, '') === target,
  )
  if (!monitor) return { ok: false, text: `no monitor for ${healthUrl}` }
  const uptime = Number(String(monitor.custom_uptime_ranges).split('-')[0])
  const ok = monitor.status === UPTIMEROBOT_UP && uptime >= MIN_UPTIME
  return { ok, text: `monitor status ${monitor.status} (2 is up), window uptime ${uptime}%` }
}

// descends(sha): the commit contains deploy.sha. A redeploy of an older SHA (a rollback) is a
// later deploy, but not a newer release.
export function healthSignal(result, deploy, descends) {
  if (result.error) return { ok: false, text: `could not be read: ${result.error}` }
  if (result.sha === deploy.sha) return { ok: true, text: `prod serves ${deploy.sha}` }
  if (deploy.newerShas.includes(result.sha) && descends(result.sha))
    return {
      ok: true,
      text: `prod already serves the newer ${result.sha}; window judged on Sentry and UptimeRobot only`,
    }
  return { ok: false, text: `prod serves ${result.sha}, not ${deploy.sha} nor a newer release` }
}

export function judge(signals) {
  return Object.values(signals).every((s) => s.ok)
}

export function windowOf(deploy) {
  const start = Date.parse(deploy.deployedAt)
  return { start, end: start + WINDOW_MS }
}

export function buildComment(deploy, signals) {
  const isClean = judge(signals)
  const ended = new Date(windowOf(deploy).end).toISOString()
  return [
    isClean ? CLEAN_HEADING : '## Observation window: needs the person',
    '',
    `- Release: ${deploy.sha}`,
    `- Window: ${deploy.deployedAt} to ${ended}`,
    `- Sentry: ${signals.sentry.text}`,
    `- UptimeRobot: ${signals.uptime.text}`,
    `- /health: ${signals.health.text}`,
    '',
    isClean
      ? 'Closing the ticket.'
      : 'Left open: review the findings. A false alarm (a signal not read, an unrelated issue): close with `pnpm work close <n>`. A real failure: follow ADR-0020 (revert or fix) and ADR-0039; the ticket stays open.',
    '',
    marker(deploy.sha),
  ].join('\n')
}

export async function fetchJson(url, init) {
  try {
    // redirect: 'error' by default keeps an API key from ever reaching another origin.
    const response = await fetch(url, {
      redirect: 'error',
      ...init,
      signal: AbortSignal.timeout(TIMEOUT_MS),
    })
    if (!response.ok) return { error: `HTTP ${response.status}` }
    return { body: await response.json() }
  } catch (error) {
    // The comment is public: name the failure, never echo a message that could carry request data.
    return { error: error.name === 'TimeoutError' ? 'timed out' : 'request failed' }
  }
}

// The deploy's own window, not one relative to when this runs: a late run must not lose its start.
export function sentryQuery(deploy) {
  const { start, end } = windowOf(deploy)
  return new URLSearchParams({
    query: `firstRelease:${deploy.sha}`,
    environment: 'prod',
    start: new Date(start).toISOString(),
    end: new Date(end).toISOString(),
  })
}

export function uptimeRange(deploy) {
  const { start, end } = windowOf(deploy)
  return `${Math.floor(start / 1000)}_${Math.floor(end / 1000)}`
}

export async function readSentry(env, deploy, get = fetchJson) {
  if (!env.SENTRY_READ_TOKEN) return { missing: 'SENTRY_READ_TOKEN' }
  if (!env.SENTRY_ORG) return { missing: 'SENTRY_ORG' }
  const query = sentryQuery(deploy)
  const issues = () =>
    get(
      `https://de.sentry.io/api/0/organizations/${encodeURIComponent(env.SENTRY_ORG)}/issues/?${query}`,
      { headers: { Authorization: `Bearer ${env.SENTRY_READ_TOKEN}` } },
    )
  const { body, error } = await issues()
  if (error !== 'HTTP 404') return error ? { error } : { issues: body }
  // Sentry 404s an environment that has never received an event. If the same query works
  // without it, prod has sent no event at all, so it has no new issue either.
  query.delete('environment')
  return (await issues()).error ? { error } : { issues: [] }
}

async function readUptime(env, deploy) {
  if (!env.UPTIMEROBOT_READ_KEY) return { missing: 'UPTIMEROBOT_READ_KEY' }
  const { body, error } = await fetchJson('https://api.uptimerobot.com/v2/getMonitors', {
    method: 'POST',
    headers: { 'Content-Type': 'application/x-www-form-urlencoded' },
    body: new URLSearchParams({
      api_key: env.UPTIMEROBOT_READ_KEY,
      format: 'json',
      custom_uptime_ranges: uptimeRange(deploy),
    }),
  })
  return error ? { error } : { response: body }
}

// No credentials go to /health, so it may redirect.
export async function readHealth(healthUrl) {
  const { body, error } = await fetchJson(healthUrl, { redirect: 'follow' })
  if (error) return { error }
  return typeof body?.sha === 'string' ? { sha: body.sha } : { error: 'no sha in the body' }
}

function run(command, args, { input } = {}) {
  return execFileSync(command, args, {
    cwd: ROOT,
    encoding: 'utf8',
    input,
    stdio: [input == null ? 'ignore' : 'pipe', 'pipe', 'pipe'],
    maxBuffer: 64 * 1024 * 1024,
  })
}

const ghJson = (args) => JSON.parse(run('gh', ['api', ...args]))

const ghLines = (args) =>
  run('gh', ['api', '--paginate', ...args, '--jq', '.[]'])
    .split(/\r?\n/)
    .filter(Boolean)
    .map((line) => JSON.parse(line))

function readDeploys(repository, now) {
  // ponytail: every page and the statuses of every past deploy on each run; add a lookback once
  // the deploy count brings the hourly run near the API rate limit.
  const deployments = ghLines([`repos/${repository}/deployments?environment=prod&per_page=100`])
  // Statuses only of deployments old enough to have a closed window (or to be the "from" of one).
  return deployments.map((d) => ({
    sha: d.sha,
    createdAt: d.created_at,
    deployedAt:
      Date.parse(d.created_at) + WINDOW_MS <= now.getTime()
        ? successTime(ghLines([`repos/${repository}/deployments/${d.id}/statuses?per_page=100`]))
        : null,
  }))
}

function descendsFrom(ancestor) {
  return (sha) => {
    try {
      run('git', ['merge-base', '--is-ancestor', ancestor, sha])
      return true
    } catch {
      return false
    }
  }
}

function issuesOf(deploy) {
  try {
    return parseRefs(run('git', messagesLogArgs(deploy.sha, deploy.from)))
  } catch {
    // A partial range would judge some tickets and silently forget the rest.
    throw new Error(
      `${deploy.from ?? ''}..${deploy.sha} is not in the history: check out the full history (fetch-depth: 0).`,
    )
  }
}

async function main(argv, env) {
  const isDryRun = argv.includes('--dry-run')
  const config = parse(readFileSync(join(ROOT, 'project.yaml'), 'utf8'))
  const repository = config.github.repository
  const healthUrl = `${config.environments.prod.url}/health`
  const authors = observationAuthors(config)
  const io = { run, log: console.log, warn: console.error }
  const now = new Date()
  let failures = 0

  const pending = pendingDeploys(readDeploys(repository, now), now)
  if (!pending.length) console.log('No prod deploy with a closed observation window.')
  // git log stops at a shallow boundary without failing: a range would lose tickets silently.
  if (pending.length && run('git', ['rev-parse', '--is-shallow-repository']).trim() === 'true')
    throw new Error('The checkout is shallow: check out the full history (fetch-depth: 0).')
  const actionFor = (number, sha) => {
    const issue = ghJson([`repos/${repository}/issues/${number}`])
    const comments = readComments(io, repository, number)
    const events = ghLines([`repos/${repository}/issues/${number}/events?per_page=100`])
    return { issue, action: ticketAction(issue, comments, sha, authors, events) }
  }
  const close = (issue) => {
    run('gh', [
      'issue',
      'close',
      String(issue.number),
      '--repo',
      repository,
      '--reason',
      'completed',
      '--comment',
      closeComment(),
    ])
    moveCard(issue.html_url, 'Done', { dryRun: false }, config, io)
  }
  const attempt = (number, action) => {
    try {
      action()
    } catch (error) {
      console.error(`#${number}: ${error.stderr?.toString().trim() || error.message}`)
      failures++
    }
  }

  for (const deploy of pending) {
    let numbers
    try {
      numbers = issuesOf(deploy)
    } catch (error) {
      console.error(error.message)
      failures++
      continue
    }
    const toJudge = []
    for (const number of numbers)
      attempt(number, () => {
        const { issue, action } = actionFor(number, deploy.sha)
        if (action === 'judge') toJudge.push(issue)
        if (action !== 'close') return
        console.log(`#${number} (${deploy.sha}): judged clean but still open, closing again`)
        if (!isDryRun) close(issue)
      })
    if (!toJudge.length) {
      console.log(`${deploy.sha}: no open, unjudged ticket.`)
      continue
    }

    const signals = {
      sentry: sentrySignal(await readSentry(env, deploy), deploy.sha),
      uptime: uptimeSignal(await readUptime(env, deploy), healthUrl),
      health: healthSignal(await readHealth(healthUrl), deploy, descendsFrom(deploy.sha)),
    }
    const body = buildComment(deploy, signals)
    const isClean = judge(signals)

    for (const issue of toJudge) {
      const { number } = issue
      console.log(`#${number} (${deploy.sha}): ${isClean ? 'clean, closing' : 'needs the person'}`)
      if (isDryRun) {
        console.log(body)
        continue
      }
      attempt(number, () => {
        // Another run or the person may have acted while the signals were read.
        if (actionFor(number, deploy.sha).action !== 'judge') {
          console.log(`#${number} (${deploy.sha}): changed meanwhile, left as it is`)
          return
        }
        run('gh', ['issue', 'comment', String(number), '--repo', repository, '--body-file', '-'], {
          input: body,
        })
        if (isClean) close(issue)
      })
    }
  }
  if (failures) process.exitCode = 1
}

if (process.argv[1] && import.meta.url === pathToFileURL(process.argv[1]).href) {
  main(process.argv.slice(2), process.env).catch((error) => {
    console.error(error.stderr?.toString().trim() || error.message)
    process.exit(1)
  })
}
