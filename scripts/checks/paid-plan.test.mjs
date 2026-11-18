import assert from 'node:assert/strict'
import { test } from 'node:test'
import { paidPlanErrors } from './paid-plan.mjs'

// Built at runtime so `pnpm debt` does not read these samples as marks of this file.
const mark = (inside) => `// ${'paid'}-plan(${inside}): batches of 500`

test('passes on well-formed marks and on docs', () => {
  const lines = [
    { file: 'apps/api/src/x.ts', line: 1, text: mark('ADR-0056') },
    { file: 'apps/api/src/y.ts', line: 2, text: mark('D56') },
    { file: 'docs/procedures/x.md', line: 3, text: mark('<decision>') },
  ]
  assert.deepEqual(paidPlanErrors(lines), [])
})

test('fails on a mark without a decision', () => {
  const errors = paidPlanErrors([{ file: 'apps/api/src/x.ts', line: 7, text: mark('56') }])
  assert.equal(errors.length, 1)
  assert.match(errors[0], /^apps\/api\/src\/x.ts:7: malformed/)
})
