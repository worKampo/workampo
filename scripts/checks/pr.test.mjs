import assert from 'node:assert/strict'
import { test } from 'node:test'
import { CHECKS, runChecks } from './pr.mjs'

test('prints one line per check, fails on errors, not on warnings', () => {
  const lines = []
  const failed = runChecks(
    [
      { name: 'Ok', check: () => ({ errors: [] }) },
      { name: 'Warn', check: () => ({ errors: [], warnings: ['dup'] }) },
      { name: 'Bad', check: () => ({ errors: ['broken'] }) },
      {
        name: 'Throws',
        check: () => {
          throw new Error('gh down')
        },
      },
    ],
    {},
    (line) => lines.push(line),
  )
  assert.equal(failed, 2)
  assert.deepEqual(lines, [
    'PASS Ok',
    'PASS Warn',
    '::warning::Warn: dup',
    'FAIL Bad',
    '  - broken',
    'FAIL Throws',
    '  - gh down',
  ])
})

test('runs every check module', () => {
  assert.equal(CHECKS.length, 11)
  for (const { name, check } of CHECKS) assert.ok(name && typeof check === 'function')
})
