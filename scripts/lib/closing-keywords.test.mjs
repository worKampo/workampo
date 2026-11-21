import assert from 'node:assert/strict'
import { test } from 'node:test'
import { closingRefs } from './closing-keywords.mjs'

test('finds every GitHub closing keyword before an issue number', () => {
  assert.deepEqual(closingRefs('the stg run closes #54 and moves its card'), [54])
  assert.deepEqual(closingRefs('Fixes: #3, resolved #4. CLOSE #5'), [3, 4, 5])
  assert.deepEqual(closingRefs('fixed worKampo/workampo#7'), [7])
})

test('ignores references that close nothing', () => {
  assert.deepEqual(closingRefs('Ticket #9 · PRD #4 · Refs: #9 · see #12'), [])
  assert.deepEqual(closingRefs('closes the ticket 54; a fixture #3; disclosed #2'), [])
  assert.deepEqual(closingRefs(undefined), [])
})
