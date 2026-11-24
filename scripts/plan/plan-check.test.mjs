import assert from 'node:assert/strict'
import { test } from 'node:test'
import { checkDesign, checkPlan } from './plan-check.mjs'

const table = (rows, waves) =>
  `| ID | Task | Depends on | Touches | Size | Level | Status |
| --- | --- | --- | --- | --- | --- | --- |
${rows.map((r) => `| ${r.join(' | ')} | M | standard | todo |`).join('\n')}

Waves: ${waves}
`

test('accepts a valid plan with ranges and folders', () => {
  const plan = table(
    [
      ['T1', 'a', '—', 'scripts/a/, package.json'],
      ['T2', 'b', '—', 'scripts/b/'],
      ['T3', 'c', 'T1–T2', 'docs/x.md, AGENTS.md'],
    ],
    '1 → T1 [P] T2 · 2 → T3',
  )
  assert.deepEqual(checkPlan(plan), [])
})

test('reports an unknown dependency', () => {
  const plan = table([['T1', 'a', 'T9', 'x.md']], '1 → T1')
  assert.ok(checkPlan(plan).some((p) => p.includes('unknown dependency T9')))
})

test('reports a cycle', () => {
  const plan = table(
    [
      ['T1', 'a', 'T2', 'a.md'],
      ['T2', 'b', 'T1', 'b.md'],
    ],
    '1 → T1 · 2 → T2',
  )
  assert.ok(checkPlan(plan).some((p) => p.startsWith('cycle: ')))
})

test('reports a task in a wave before its dependency', () => {
  const plan = table(
    [
      ['T1', 'a', '—', 'a.md'],
      ['T2', 'b', 'T1', 'b.md'],
    ],
    '1 → T2 · 2 → T1',
  )
  assert.ok(checkPlan(plan).some((p) => p.includes('T2: in wave 1 but depends on T1')))
})

test('reports the same file or a containing folder inside a wave', () => {
  const plan = table(
    [
      ['T1', 'a', '—', 'package.json'],
      ['T2', 'b', '—', 'package.json'],
      ['T3', 'c', '—', 'docs/'],
      ['T4', 'd', '—', 'docs/adr/0020.md'],
    ],
    '1 → T1 [P] T2 [P] T3 [P] T4',
  )
  const problems = checkPlan(plan)
  assert.ok(problems.some((p) => p.includes('T1 and T2 both touch package.json')))
  assert.ok(problems.some((p) => p.includes('T3 and T4')))
})

test('reports a task missing from the waves', () => {
  const plan = table(
    [
      ['T1', 'a', '—', 'a.md'],
      ['T2', 'b', '—', 'b.md'],
    ],
    '1 → T1',
  )
  assert.deepEqual(checkPlan(plan), ['T2: missing from the waves'])
})

test('reports a repeated wave number and a task in two waves', () => {
  const rows = [
    ['T1', 'a', '—', 'x.md'],
    ['T2', 'b', 'T1', 'x.md'],
  ]
  assert.ok(
    checkPlan(table(rows, '1 → T1 · 1 → T2')).includes('Waves: wave 1 appears more than once'),
  )
  assert.ok(
    checkPlan(table(rows, '1 → T2 · 2 → T1 · 3 → T2')).includes(
      'Waves: T2 is in more than one wave',
    ),
  )
})

test('reads an indented Waves line', () => {
  const plan = table([['T1', 'a', '—', 'x.md']], '1 → T1').replace('Waves:', '  Waves:')
  assert.deepEqual(checkPlan(plan), [])
})

test('a plan.md without "Seams and sharing" fails; with it, passes', () => {
  assert.equal(checkDesign('## Data model\nTables.\n').length, 1)
  assert.deepEqual(checkDesign('## Seams and sharing\nIdentity provider: none.\n'), [])
})
