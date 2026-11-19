import assert from 'node:assert/strict'
import { test } from 'node:test'
import { findMarks } from './debt.mjs'

test('accepts ADR-NNNN and DNN', () => {
  const marks = findMarks('// paid-plan(ADR-0056): x\n\n// paid-plan(D56): y')
  assert.deepEqual(
    marks.map((m) => [m.line, m.valid]),
    [
      [1, true],
      [3, true],
    ],
  )
})

test('flags malformed marks', () => {
  const bad = [
    'paid-plan(56)',
    'paid-plan(ADR-56)',
    'paid-plan()',
    'paid-plan(D5)',
    'paid-plan(ADR-0056',
  ]
  for (const mark of bad) assert.equal(findMarks(`// ${mark}`)[0].valid, false, mark)
})

test('ignores prose without parentheses', () => {
  assert.deepEqual(findMarks('the paid-plan mark'), [])
})
