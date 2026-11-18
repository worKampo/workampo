import assert from 'node:assert/strict'
import { test } from 'node:test'
import { applyBlock, renderBlock } from './sync.mjs'

const block = renderBlock([
  { id: 'T1', title: 'Core', status: 'done' },
  { id: 'T2', title: 'Next', status: 'todo' },
  { id: 'T3', title: 'Now', status: 'doing' },
])

test('renders done, todo and doing', () => {
  assert.equal(
    block,
    [
      '<!-- tasks:start -->',
      '- [x] T1 · Core',
      '- [ ] T2 · Next',
      '- [ ] T3 · Now · 🔄 in progress',
      '<!-- tasks:end -->',
    ].join('\n'),
  )
})

test('adds a Tasks section when the markers are missing', () => {
  assert.equal(applyBlock('Intent\n', block), `Intent\n\n## Tasks\n\n${block}\n`)
})

test('replaces only what is between the markers', () => {
  const body =
    'Intent\n\n## Tasks\n\n<!-- tasks:start -->\n- [ ] T1 · old\n<!-- tasks:end -->\n\nTail\n'
  assert.equal(applyBlock(body, block), `Intent\n\n## Tasks\n\n${block}\n\nTail\n`)
})

test('is idempotent', () => {
  const once = applyBlock('Intent', block)
  assert.equal(applyBlock(once, block), once)
})
