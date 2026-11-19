import assert from 'node:assert/strict'
import { test } from 'node:test'
import { check } from './temporaries.mjs'
import { context, failure } from './test-support.mjs'

const ctxWith = (tree, grep) =>
  context({
    routes: [
      [/^git ls-tree/, tree.join('\n')],
      [/^git grep/, grep],
    ],
  })

test('passes without .work/ and with @wip only in the README', () => {
  const ctx = ctxWith(
    ['docs/domains/companies.md', 'scripts/work/work.mjs'],
    'head:docs/domains/README.md:44:| `@wip(#n)` | On the `Rule:` |\n',
  )
  assert.deepEqual(check(ctx).errors, [])
})

test('fails on a kept .work/ file and an @wip rule', () => {
  const ctx = ctxWith(
    ['.work/plan.md', 'apps/api/src/index.ts'],
    'head:docs/domains/companies.md:7:  @wip(#9)\n',
  )
  assert.deepEqual(check(ctx).errors, [
    '.work/plan.md must be deleted',
    'docs/domains/companies.md:7: @wip must become @issue',
  ])
})

test('no @wip anywhere is fine', () => {
  assert.deepEqual(check(ctxWith([], failure(1))).errors, [])
})
