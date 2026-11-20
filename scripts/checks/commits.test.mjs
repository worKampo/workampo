import assert from 'node:assert/strict'
import { test } from 'node:test'
import { refsTicket } from '../../commitlint.config.mjs'
import { check, summarize } from './commits.mjs'
import { context, logOf, RENOVATE } from './test-support.mjs'

test('the local rule wants Refs: #<ticket> as a line', () => {
  assert.equal(refsTicket({ raw: 'feat: x\n\nRefs: #9\n' }, 'always', '9')[0], true)
  assert.equal(refsTicket({ raw: 'feat: x\n\nRefs: #90\n' }, 'always', '9')[0], false)
  assert.equal(refsTicket({ raw: 'feat: x' }, 'always', '9')[0], false)
  assert.equal(refsTicket({ raw: 'feat: x' }, 'always', '')[0], true)
})

test('the local rule rejects a trailer the closer would not parse', () => {
  assert.equal(refsTicket({ raw: 'feat: x\n\nRefs: #9 \n' }, 'always', '9')[0], false)
})

test('the local rule rejects a Refs trailer of another ticket and names it', () => {
  const [ok, message] = refsTicket({ raw: 'feat: x\n\nRefs: #9\nRefs: #12\n' }, 'always', '9')
  assert.equal(ok, false)
  assert.match(message, /#12/)
  assert.equal(refsTicket({ raw: 'feat: x\n\nRefs: #9\nRefs: #9\n' }, 'always', '9')[0], true)
  assert.equal(refsTicket({ raw: 'feat: x\n\nRefs: #12\n' }, 'always', '')[0], true)
  assert.equal(refsTicket({ raw: 'feat: x\n\nRefs: #9\nRefs: #12\n' }, 'never', '9')[0], true)
})

function commitlint(ref, authors, outcome) {
  const env = []
  const ctx = context({
    env: { HEAD_REF: ref },
    routes: [
      [/^git log/, logOf(authors)],
      [
        /commitlint.*--from base --to head$/,
        (_args, options) => {
          env.push(options.env.TICKET)
          return outcome()
        },
      ],
    ],
  })
  return { result: check(ctx), ticket: env[0] }
}

test('passes the branch ticket to commitlint', () => {
  const { result, ticket } = commitlint('feature/9-x', [{ sha: 'h1' }], () => '')
  assert.deepEqual(result.errors, [])
  assert.equal(ticket, '9')
})

test('reports commitlint output on failure', () => {
  const { result } = commitlint('feature/9-x', [{ sha: 'h1' }], () => {
    const error = new Error('exit 1')
    error.stdout = '✖   every commit needs the trailer "Refs: #9" [refs-ticket]\n'
    throw error
  })
  assert.match(result.errors[0], /Refs: #9/)
})

test('keeps the subject and the problems of commitlint output', () => {
  const output = [
    '\x1b[90m⧗\x1b[39m   --- input ---',
    '\x1b[1mfeat: x',
    '',
    'long body\x1b[22m',
    '\x1b[31m✖\x1b[39m   every commit needs the trailer "Refs: #9" [refs-ticket]',
    '✖   found 1 problems, 0 warnings',
  ].join('\n')
  assert.deepEqual(summarize(output), [
    'commit "feat: x"',
    '  every commit needs the trailer "Refs: #9" [refs-ticket]',
  ])
})

test('Renovate is linted without the Refs rule', () => {
  const bot = { sha: 'r1', email: RENOVATE, name: 'renovate[bot]' }
  const { ticket } = commitlint('renovate/all-minor', [bot], () => '')
  assert.equal(ticket, '')
})
