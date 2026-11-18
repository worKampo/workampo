import assert from 'node:assert/strict'
import { test } from 'node:test'
import { applyBlock, parseSyncArgs, renderBlock } from './sync.mjs'

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

test('parses the issue, the file and --dry-run, and rejects unknown options', () => {
  assert.deepEqual(parseSyncArgs(['15']), { issue: '15', file: '.work/tasks.md', dryRun: false })
  assert.deepEqual(parseSyncArgs(['15', 't.md', '--dry-run']), {
    issue: '15',
    file: 't.md',
    dryRun: true,
  })
  assert.throws(() => parseSyncArgs(['15', '--dryrun']), /Unknown option '--dryrun'/)
  assert.throws(() => parseSyncArgs(['--dry-run']), /usage: plan:sync/)
  assert.throws(() => parseSyncArgs(['15', 'a.md', 'b.md']), /usage: plan:sync/)
})
