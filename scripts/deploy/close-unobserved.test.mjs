import assert from 'node:assert/strict'
import { test } from 'node:test'
import { messagesLogArgs } from '../smoke/verification-comment.mjs'
import { closeUnobserved, parseArgs } from './close-unobserved.mjs'

const SHA = 'a1b2c3d4e5f60718293a4b5c6d7e8f9012345678'
const FROM = 'ffffffffffffffffffffffffffffffffffffffff'
const OLD = 'dddddddddddddddddddddddddddddddddddddddd'
const TIP = 'eeeeeeeeeeeeeeeeeeeeeeeeeeeeeeeeeeeeeeee'
const LATER = 'cccccccccccccccccccccccccccccccccccccccc'
const TEXT = 'Sin Workers afectados: nada que observar'
const MARKER = `<!-- no-workers:${SHA} -->`
const OPEN = { state: 'open' }
const CLOSED = { state: 'closed' }
const BOT = { login: 'github-actions[bot]', type: 'Bot' }
const AUTHORS = [BOT]

// issues: number -> { state }; comments: number -> [{ body }]; history: number -> SHAs on master
// up to the master tip whose message has `Refs: #number` (defaults to the merge itself); workerCommits:
// SHAs that affect a Worker; failing: { issue|comments|comment|close|affectsWorker: [numbers] }.
function fakeIo({
  log = `docs: x (#60)\n\nRefs: #50\n`,
  issues = { 50: OPEN },
  comments = {},
  history = {},
  workerCommits = [],
  failing = {},
} = {}) {
  const calls = []
  const failIf = (kind, key) => {
    if ((failing[kind] ?? []).includes(key)) throw new Error(`${kind} failed`)
  }
  const io = {
    authors: AUTHORS,
    log: () => {},
    warn: () => {},
    run: (command, args) => {
      calls.push({ command, args })
      if (command === 'git' && args[0] === 'log') return log
      throw new Error(`unexpected ${command} ${args.join(' ')}`)
    },
    issue: (number) => {
      calls.push({ command: 'issue', number })
      failIf('issue', number)
      return { html_url: `https://github.com/o/r/issues/${number}`, ...(issues[number] ?? OPEN) }
    },
    comments: (number) => {
      calls.push({ command: 'comments', number })
      failIf('comments', number)
      return comments[number] ?? []
    },
    masterTip: () => {
      if (failing.masterTip) throw new Error('masterTip failed')
      return TIP
    },
    ticketCommits: (number, tip) => {
      calls.push({ command: 'ticketCommits', number, tip })
      return history[number] ?? [SHA]
    },
    affectsWorker: (commit) => {
      calls.push({ command: 'affectsWorker', commit })
      for (const [number, shas] of Object.entries(history))
        if (shas.includes(commit)) failIf('affectsWorker', Number(number))
      return workerCommits.includes(commit)
    },
    comment: (number, body) => {
      calls.push({ command: 'comment', number, body })
      failIf('comment', number)
    },
    close: (number, reason) => {
      calls.push({ command: 'close', number, reason })
      failIf('close', number)
    },
    moveToDone: (number, url) => {
      calls.push({ command: 'moveToDone', number, url })
    },
  }
  return { io, calls }
}

const commented = (calls) => calls.filter((c) => c.command === 'comment').map((c) => c.number)
const closed = (calls) => calls.filter((c) => c.command === 'close').map((c) => c.number)
const sorted = (numbers) => [...numbers].sort((a, b) => a - b)

test('E1: a docs-only merge comments and closes its ticket as completed', async () => {
  const { io, calls } = fakeIo()
  assert.deepEqual(await closeUnobserved({ sha: SHA, from: FROM }, io), [])

  assert.deepEqual(calls.find((c) => c.command === 'git').args, messagesLogArgs(SHA, FROM))
  const comment = calls.find((c) => c.command === 'comment')
  assert.equal(comment.number, 50)
  assert.ok(comment.body.includes(TEXT), comment.body)
  assert.ok(comment.body.includes(MARKER), comment.body)
  assert.deepEqual(
    calls.filter((c) => c.command === 'close'),
    [{ command: 'close', number: 50, reason: 'completed' }],
  )
  // The explanation is there before the ticket closes.
  assert.ok(calls.indexOf(comment) < calls.findIndex((c) => c.command === 'close'))
})

test('E1: tickets come from every commit of from..sha', async () => {
  const { io, calls } = fakeIo({
    log: 'docs: a\n\nRefs: #50\n\ndocs: b\n\nRefs: #51\nRefs: #52\n',
    issues: { 50: OPEN, 51: OPEN, 52: OPEN },
  })
  assert.deepEqual(await closeUnobserved({ sha: SHA, from: FROM }, io), [])
  assert.deepEqual(sorted(commented(calls)), [50, 51, 52])
  assert.deepEqual(sorted(closed(calls)), [50, 51, 52])
})

test('E1: with no previous SHA only the merge commit is read', async () => {
  const { io, calls } = fakeIo()
  await closeUnobserved({ sha: SHA, from: '' }, io)
  assert.deepEqual(calls.find((c) => c.command === 'git').args, messagesLogArgs(SHA, ''))
  assert.deepEqual(closed(calls), [50])
})

test('E2: a ticket whose commit in the range affects a Worker stays open', async () => {
  const { io, calls } = fakeIo({
    issues: { 51: OPEN },
    log: 'feat: x\n\nRefs: #51\n',
    workerCommits: [SHA],
  })
  assert.deepEqual(await closeUnobserved({ sha: SHA, from: FROM }, io), [])
  assert.deepEqual(commented(calls), [])
  assert.deepEqual(closed(calls), [])
})

test('E3: an earlier Worker commit on master keeps the ticket open; the rest close', async () => {
  const { io, calls } = fakeIo({
    log: 'docs: x\n\nRefs: #50\nRefs: #52\n',
    issues: { 50: OPEN, 52: OPEN },
    history: { 50: [SHA], 52: [OLD, SHA] },
    workerCommits: [OLD],
  })
  assert.deepEqual(await closeUnobserved({ sha: SHA, from: FROM }, io), [])
  // History is read up to the tip of master, which can be past the merge.
  for (const c of calls.filter((c) => c.command === 'ticketCommits')) assert.equal(c.tip, TIP)
  assert.deepEqual(commented(calls), [50])
  assert.deepEqual(closed(calls), [50])
})

test('E3: a later Worker commit on master naming the ticket keeps it open', async () => {
  const { io, calls } = fakeIo({
    issues: { 50: OPEN },
    history: { 50: [LATER, SHA] },
    workerCommits: [LATER],
  })
  assert.deepEqual(await closeUnobserved({ sha: SHA, from: FROM }, io), [])
  assert.deepEqual(commented(calls), [])
  assert.deepEqual(closed(calls), [])
})

test('E3: a master tip that cannot be fetched fails and closes nothing', async () => {
  const { io, calls } = fakeIo({ failing: { masterTip: true } })
  await assert.rejects(closeUnobserved({ sha: SHA, from: FROM }, io), /masterTip failed/)
  assert.deepEqual(closed(calls), [])
})

test('E3: a failing Worker check keeps the ticket open and is reported', async () => {
  const { io, calls } = fakeIo({
    log: 'docs: x\n\nRefs: #50\nRefs: #52\n',
    issues: { 50: OPEN, 52: OPEN },
    history: { 50: [SHA], 52: [OLD] },
    failing: { affectsWorker: [52] },
  })
  assert.deepEqual(await closeUnobserved({ sha: SHA, from: FROM }, io), [52])
  assert.deepEqual(closed(calls), [50])
})

test('E5: an already-closed ticket gets no comment and no close', async () => {
  const { io, calls } = fakeIo({ log: 'docs: x\n\nRefs: #54\n', issues: { 54: CLOSED } })
  assert.deepEqual(await closeUnobserved({ sha: SHA, from: FROM }, io), [])
  assert.deepEqual(commented(calls), [])
  assert.deepEqual(closed(calls), [])
})

test('idempotent: the marker already on an open ticket closes it without a second comment', async () => {
  const { io, calls } = fakeIo({ comments: { 50: [{ user: BOT, body: `${TEXT}\n\n${MARKER}` }] } })
  assert.deepEqual(await closeUnobserved({ sha: SHA, from: FROM }, io), [])
  assert.deepEqual(commented(calls), [])
  assert.deepEqual(closed(calls), [50])
})

test('a marker from an untrusted author is ignored: the comment is posted, then the close', async () => {
  const stranger = { user: { login: 'stranger', type: 'User' }, body: MARKER }
  const spoofed = { user: { login: 'github-actions[bot]', type: 'User' }, body: MARKER }
  const { io, calls } = fakeIo({ comments: { 50: [stranger, spoofed] } })
  assert.deepEqual(await closeUnobserved({ sha: SHA, from: FROM }, io), [])
  assert.deepEqual(commented(calls), [50])
  assert.deepEqual(closed(calls), [50])
  assert.ok(
    calls.findIndex((c) => c.command === 'comment') < calls.findIndex((c) => c.command === 'close'),
  )
})

test('F4: a pull request number is skipped before anything else, and is not a failure', async () => {
  const { io, calls } = fakeIo({
    log: 'docs: x\n\nRefs: #50\nRefs: #51\n',
    issues: { 50: { state: 'open', pull_request: {} }, 51: OPEN },
  })
  assert.deepEqual(await closeUnobserved({ sha: SHA, from: FROM }, io), [])
  const touching50 = calls.filter((c) => c.number === 50)
  assert.deepEqual(touching50, [{ command: 'issue', number: 50 }])
  assert.deepEqual(closed(calls), [51])
})

test('idempotent: a second run after a full success does nothing', async () => {
  const { io, calls } = fakeIo({
    issues: { 50: CLOSED },
    comments: { 50: [{ user: BOT, body: `${TEXT}\n\n${MARKER}` }] },
  })
  assert.deepEqual(await closeUnobserved({ sha: SHA, from: FROM }, io), [])
  assert.deepEqual(commented(calls), [])
  assert.deepEqual(closed(calls), [])
})

test('one failing ticket does not stop the rest and is returned', async () => {
  const { io, calls } = fakeIo({
    log: 'docs: x\n\nRefs: #3\nRefs: #5\nRefs: #8\nRefs: #9\nRefs: #11\n',
    issues: { 3: OPEN, 5: OPEN, 8: OPEN, 9: OPEN, 11: OPEN },
    failing: { comment: [5], close: [8], issue: [9], comments: [11] },
  })
  assert.deepEqual(sorted(await closeUnobserved({ sha: SHA, from: FROM }, io)), [5, 8, 9, 11])
  // A ticket whose comment failed is not closed without its explanation.
  assert.deepEqual(sorted(closed(calls)), [3, 8])
})

test('a range missing from the history fails instead of closing part of it', async () => {
  const { io, calls } = fakeIo()
  io.run = () => {
    throw new Error('bad revision')
  }
  await assert.rejects(closeUnobserved({ sha: SHA, from: FROM }, io))
  assert.deepEqual(closed(calls), [])
})

test('no Refs trailer touches no issue', async () => {
  const { io, calls } = fakeIo({ log: 'docs: typo (#60)\n\nno ticket here\n' })
  assert.deepEqual(await closeUnobserved({ sha: SHA, from: FROM }, io), [])
  assert.deepEqual(
    calls.filter((c) => c.command !== 'git'),
    [],
  )
})

test('a ticket named by several commits gets one comment and one close', async () => {
  const { io, calls } = fakeIo({ log: 'docs: a\n\nRefs: #50\n\ndocs: b\n\nRefs: #50\nRefs: #50\n' })
  assert.deepEqual(await closeUnobserved({ sha: SHA, from: FROM }, io), [])
  assert.deepEqual(commented(calls), [50])
  assert.deepEqual(closed(calls), [50])
})

test('malformed or inline references close nothing', async () => {
  const log = [
    'docs: see #50 and (#51)',
    '',
    'Refs #52',
    'Refs: 53',
    'Refs: #54abc',
    'Refs: #',
    'Fixes: #55',
    '  text Refs: #56',
    'Refs: #５７',
  ].join('\n')
  const { io, calls } = fakeIo({ log })
  assert.deepEqual(await closeUnobserved({ sha: SHA, from: FROM }, io), [])
  assert.deepEqual(
    calls.filter((c) => c.command !== 'git'),
    [],
  )
})

test('parseArgs takes a full SHA and an optional previous SHA', async () => {
  assert.deepEqual(parseArgs([SHA]), { sha: SHA, from: '' })
  assert.deepEqual(parseArgs([SHA, FROM]), { sha: SHA, from: FROM })
  assert.deepEqual(parseArgs([SHA, '']), { sha: SHA, from: '' })
})

test('parseArgs refuses anything that is not a full SHA, before it reaches git', async () => {
  // `from` comes from the /health of a Worker: it must not become a git option.
  for (const argv of [
    [],
    [''],
    ['HEAD'],
    ['a1b2c3d'],
    ['--output=/tmp/x'],
    [SHA, '--output=/tmp/x'],
    [SHA, 'HEAD~1'],
    [SHA.toUpperCase()],
    [`${SHA}\n`],
    [SHA, FROM, 'extra'],
  ])
    assert.throws(() => parseArgs(argv), /Usage/, JSON.stringify(argv))
})

test('a closed ticket moves its board card to Done; a skipped or failed one does not', async () => {
  const { io, calls } = fakeIo({
    log: 'docs: x\n\nRefs: #50\nRefs: #51\nRefs: #54\nRefs: #55\nRefs: #56\n',
    issues: { 50: OPEN, 51: OPEN, 54: CLOSED, 55: OPEN, 56: OPEN },
    history: { 50: [SHA], 51: [OLD], 54: [SHA], 55: [SHA], 56: [SHA] },
    workerCommits: [OLD],
    failing: { comment: [55], close: [56] },
  })
  assert.deepEqual(sorted(await closeUnobserved({ sha: SHA, from: FROM }, io)), [55, 56])
  assert.deepEqual(
    calls.filter((c) => c.command === 'moveToDone'),
    [{ command: 'moveToDone', number: 50, url: 'https://github.com/o/r/issues/50' }],
  )
  // The card moves only after the close.
  assert.ok(
    calls.findIndex((c) => c.command === 'close' && c.number === 50) <
      calls.findIndex((c) => c.command === 'moveToDone'),
  )
})
