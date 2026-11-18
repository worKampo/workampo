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
const DEPLOYS_READ = 30
const TIMEOUT_MS = 15_000

export const marker = (sha) => `<!-- observation-window:${sha} -->`

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

export function isJudged(comments, sha, authors) {
  return comments.some(
    (c) =>
      (c.body ?? '').includes(marker(sha)) &&
      authors.some((a) => a.login === c.user?.login && a.type === c.user?.type),
  )
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
  if (result.response.stat !== 'ok')
    return { ok: false, text: `could not be read: ${JSON.stringify(result.response.error ?? {})}` }
  const target = healthUrl.replace(/\/+$/, '')
  const monitor = (result.response.monitors ?? []).find(
    (m) => (m.url ?? '').replace(/\/+$/, '') === target,
  )
  if (!monitor) return { ok: false, text: `no monitor for ${healthUrl}` }
  const uptime = Number(String(monitor.custom_uptime_ratio).split('-')[0])
  const ok = monitor.status === UPTIMEROBOT_UP && uptime >= MIN_UPTIME
  return { ok, text: `monitor status ${monitor.status} (2 is up), 1-day uptime ${uptime}%` }
}

export function healthSignal(result, deploy) {
  if (result.error) return { ok: false, text: `could not be read: ${result.error}` }
  if (result.sha === deploy.sha) return { ok: true, text: `prod serves ${deploy.sha}` }
  if (deploy.newerShas.includes(result.sha))
    return {
      ok: true,
      text: `prod already serves the newer ${result.sha}; window judged on Sentry and UptimeRobot only`,
    }
  return { ok: false, text: `prod serves ${result.sha}, not ${deploy.sha} nor a newer deploy` }
}

export function judge(signals) {
  return Object.values(signals).every((s) => s.ok)
}

export function buildComment(deploy, signals) {
  const isClean = judge(signals)
  const ended = new Date(Date.parse(deploy.deployedAt) + WINDOW_MS).toISOString()
  return [
    isClean ? '## Observation window clean' : '## Observation window: needs the person',
    '',
    `- Release: ${deploy.sha}`,
    `- Window: ${deploy.deployedAt} to ${ended}`,
    `- Sentry: ${signals.sentry.text}`,
    `- UptimeRobot: ${signals.uptime.text}`,
    `- /health: ${signals.health.text}`,
    '',
    isClean
      ? 'Closing the ticket.'
      : 'Left open: review the findings, then close with `pnpm work close <n>` if the release is fine.',
    '',
    marker(deploy.sha),
  ].join('\n')
}

async function fetchJson(url, init) {
  try {
    const response = await fetch(url, { ...init, signal: AbortSignal.timeout(TIMEOUT_MS) })
    if (!response.ok) return { error: `HTTP ${response.status}` }
    return { body: await response.json() }
  } catch (error) {
    return { error: error.message }
  }
}

async function readSentry(env, sha) {
  if (!env.SENTRY_READ_TOKEN) return { missing: 'SENTRY_READ_TOKEN' }
  if (!env.SENTRY_ORG) return { missing: 'SENTRY_ORG' }
  const query = new URLSearchParams({
    query: `firstRelease:${sha}`,
    environment: 'prod',
    statsPeriod: '48h',
  })
  const { body, error } = await fetchJson(
    `https://de.sentry.io/api/0/organizations/${encodeURIComponent(env.SENTRY_ORG)}/issues/?${query}`,
    { headers: { Authorization: `Bearer ${env.SENTRY_READ_TOKEN}` } },
  )
  return error ? { error } : { issues: body }
}

async function readUptime(env) {
  if (!env.UPTIMEROBOT_READ_KEY) return { missing: 'UPTIMEROBOT_READ_KEY' }
  const { body, error } = await fetchJson('https://api.uptimerobot.com/v2/getMonitors', {
    method: 'POST',
    headers: { 'Content-Type': 'application/x-www-form-urlencoded' },
    body: new URLSearchParams({
      api_key: env.UPTIMEROBOT_READ_KEY,
      format: 'json',
      custom_uptime_ratios: '1',
    }),
  })
  return error ? { error } : { response: body }
}

async function readHealth(healthUrl) {
  const { body, error } = await fetchJson(healthUrl)
  return error ? { error } : { sha: body.sha }
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

function readDeploys(repository, now) {
  const deployments = ghJson([
    `repos/${repository}/deployments?environment=prod&per_page=${DEPLOYS_READ}`,
  ])
  // Statuses only of deployments old enough to have a closed window (or to be the "from" of one).
  return deployments.map((d) => ({
    sha: d.sha,
    createdAt: d.created_at,
    deployedAt:
      Date.parse(d.created_at) + WINDOW_MS <= now.getTime()
        ? successTime(ghJson([`repos/${repository}/deployments/${d.id}/statuses`]))
        : null,
  }))
}

function issuesOf(deploy) {
  try {
    return parseRefs(run('git', messagesLogArgs(deploy.sha, deploy.from)))
  } catch {
    console.error(
      `${deploy.from}..${deploy.sha} is not in the history: reading ${deploy.sha} only.`,
    )
    return parseRefs(run('git', messagesLogArgs(deploy.sha)))
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
  for (const deploy of pending) {
    const issues = issuesOf(deploy).filter((number) => {
      const state = run('gh', ['api', `repos/${repository}/issues/${number}`, '--jq', '.state'])
      return (
        state.trim() === 'open' &&
        !isJudged(readComments(io, repository, number), deploy.sha, authors)
      )
    })
    if (!issues.length) {
      console.log(`${deploy.sha}: no open, unjudged ticket.`)
      continue
    }

    const signals = {
      sentry: sentrySignal(await readSentry(env, deploy.sha), deploy.sha),
      uptime: uptimeSignal(await readUptime(env), healthUrl),
      health: healthSignal(await readHealth(healthUrl), deploy),
    }
    const body = buildComment(deploy, signals)
    const isClean = judge(signals)

    for (const number of issues) {
      console.log(`#${number} (${deploy.sha}): ${isClean ? 'clean, closing' : 'needs the person'}`)
      if (isDryRun) {
        console.log(body)
        continue
      }
      try {
        run('gh', ['issue', 'comment', String(number), '--repo', repository, '--body-file', '-'], {
          input: body,
        })
        if (isClean) {
          const issue = ghJson([`repos/${repository}/issues/${number}`])
          run('gh', [
            'issue',
            'close',
            String(number),
            '--repo',
            repository,
            '--reason',
            'completed',
            '--comment',
            closeComment(),
          ])
          moveCard(issue.html_url, 'Done', { dryRun: false }, config, io)
        }
      } catch (error) {
        console.error(`#${number}: ${error.stderr?.toString().trim() || error.message}`)
        failures++
      }
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
