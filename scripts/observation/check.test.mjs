import assert from 'node:assert/strict'
import { test } from 'node:test'
import {
  buildComment,
  healthSignal,
  isJudged,
  judge,
  marker,
  observationAuthors,
  pendingDeploys,
  sentrySignal,
  successTime,
  uptimeSignal,
} from './check.mjs'

const config = { github: { account: 'workampo-dev', agentsApp: { name: 'workampo-agents' } } }
const HEALTH = 'https://app.example.com/health'
const NOW = new Date('2026-11-20T12:00:00Z')
const deploy = {
  sha: 'bbb',
  deployedAt: '2026-11-19T10:00:00Z',
  from: 'aaa',
  newerShas: ['ccc'],
}
const upMonitor = {
  stat: 'ok',
  monitors: [{ url: `${HEALTH}/`, status: 2, custom_uptime_ratio: '100.000' }],
}

function signalsFor({
  sentry = { issues: [] },
  uptime = { response: upMonitor },
  health = { sha: 'bbb' },
} = {}) {
  return {
    sentry: sentrySignal(sentry, deploy.sha),
    uptime: uptimeSignal(uptime, HEALTH),
    health: healthSignal(health, deploy),
  }
}

test('successTime takes the first success status', () => {
  const statuses = [
    { state: 'success', created_at: '2026-11-19T10:05:00Z' },
    { state: 'in_progress', created_at: '2026-11-19T10:00:00Z' },
    { state: 'success', created_at: '2026-11-19T10:01:00Z' },
  ]
  assert.equal(successTime(statuses), '2026-11-19T10:01:00Z')
  assert.equal(successTime([{ state: 'failure', created_at: '2026-11-19T10:00:00Z' }]), null)
})

test('pendingDeploys keeps windows older than 24 hours, with the previous SHA and newer ones', () => {
  const deploys = [
    { sha: 'ccc', createdAt: '2026-11-20T09:00:00Z', deployedAt: null },
    { sha: 'bbb', createdAt: '2026-11-19T09:58:00Z', deployedAt: '2026-11-19T10:00:00Z' },
    { sha: 'xxx', createdAt: '2026-11-18T08:00:00Z', deployedAt: null },
    { sha: 'aaa', createdAt: '2026-11-18T09:58:00Z', deployedAt: '2026-11-18T10:00:00Z' },
    { sha: 'aaa', createdAt: '2026-11-18T11:00:00Z', deployedAt: '2026-11-18T11:02:00Z' },
  ]
  assert.deepEqual(pendingDeploys(deploys, NOW), [
    {
      sha: 'aaa',
      deployedAt: '2026-11-18T10:00:00Z',
      from: null,
      newerShas: ['ccc', 'bbb', 'aaa'],
    },
    { sha: 'bbb', deployedAt: '2026-11-19T10:00:00Z', from: 'aaa', newerShas: ['ccc'] },
  ])
  assert.deepEqual(
    pendingDeploys(deploys, new Date('2026-11-20T09:59:00Z')).map((d) => d.sha),
    ['aaa'],
  )
})

test('a clean window gives the clean comment with the marker', () => {
  const signals = signalsFor()
  assert.equal(judge(signals), true)
  const body = buildComment(deploy, signals)
  assert.match(body, /^## Observation window clean\n/)
  assert.match(body, /- Window: 2026-11-19T10:00:00Z to 2026-11-20T10:00:00.000Z/)
  assert.match(body, /- Sentry: no new issues first seen in bbb in prod/)
  assert.match(body, /- \/health: prod serves bbb/)
  assert.ok(body.endsWith(marker('bbb')))
})

test('a new Sentry issue needs the person, listed without its title', () => {
  const issue = { shortId: 'API-1', permalink: 'https://x.sentry.io/issues/1/', title: 'secret' }
  const signals = signalsFor({ sentry: { issues: [issue] } })
  assert.equal(judge(signals), false)
  const body = buildComment(deploy, signals)
  assert.match(body, /^## Observation window: needs the person\n/)
  assert.match(body, /1 new issue\(s\) first seen in bbb: API-1 https:\/\/x.sentry.io\/issues\/1\//)
  assert.doesNotMatch(body, /secret/)
  assert.ok(body.endsWith(marker('bbb')))
})

test('a monitor down or below 99.9% uptime needs the person', () => {
  const down = { stat: 'ok', monitors: [{ url: HEALTH, status: 9, custom_uptime_ratio: '100' }] }
  const flaky = { stat: 'ok', monitors: [{ url: HEALTH, status: 2, custom_uptime_ratio: '99.5' }] }
  assert.equal(judge(signalsFor({ uptime: { response: down } })), false)
  assert.equal(judge(signalsFor({ uptime: { response: flaky } })), false)
  assert.equal(uptimeSignal({ response: { stat: 'ok', monitors: [] } }, HEALTH).ok, false)
})

test('a missing token is not checked and the window is not clean', () => {
  const signals = signalsFor({
    sentry: { missing: 'SENTRY_READ_TOKEN' },
    uptime: { missing: 'UPTIMEROBOT_READ_KEY' },
  })
  assert.equal(judge(signals), false)
  const body = buildComment(deploy, signals)
  assert.match(body, /- Sentry: not checked: SENTRY_READ_TOKEN is not set/)
  assert.match(body, /- UptimeRobot: not checked: UPTIMEROBOT_READ_KEY is not set/)
})

test('/health serving a newer deploy is fine; an older or unknown SHA is not', () => {
  assert.equal(judge(signalsFor({ health: { sha: 'ccc' } })), true)
  assert.equal(judge(signalsFor({ health: { sha: 'aaa' } })), false)
  assert.equal(judge(signalsFor({ health: { error: 'HTTP 503' } })), false)
})

test('a marker from a trusted author marks the window as judged', () => {
  const authors = observationAuthors(config)
  const comment = (login, type, sha = 'bbb') => ({
    user: { login, type },
    body: `x\n${marker(sha)}`,
  })
  assert.equal(isJudged([comment('github-actions[bot]', 'Bot')], 'bbb', authors), true)
  assert.equal(isJudged([comment('workampo-agents[bot]', 'Bot')], 'bbb', authors), true)
  assert.equal(isJudged([comment('workampo-dev', 'User')], 'bbb', authors), true)
  assert.equal(isJudged([comment('github-actions[bot]', 'Bot', 'aaa')], 'bbb', authors), false)
})

test('a marker from an untrusted author is ignored', () => {
  const authors = observationAuthors(config)
  const comments = [
    { user: { login: 'stranger', type: 'User' }, body: marker('bbb') },
    { user: { login: 'github-actions[bot]', type: 'User' }, body: marker('bbb') },
  ]
  assert.equal(isJudged(comments, 'bbb', authors), false)
})
