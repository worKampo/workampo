import assert from 'node:assert/strict'
import { mkdtempSync, readFileSync, rmSync } from 'node:fs'
import { tmpdir } from 'node:os'
import { join } from 'node:path'
import { test } from 'node:test'
import { check } from './examples.mjs'
import { context, failure } from './test-support.mjs'

const SPEC = [
  'head:docs/domains/README.md:65:  @id:library-99-1',
  'head:docs/domains/companies.md:12:    @slow @id:companies-15-1',
  'head:docs/domains/public-site.md:8:    @id:public-site-20-1',
].join('\n')

function run(tests, file) {
  const ctx = context({
    env: { VERIFICATION_FILE: file },
    routes: [
      [/^git grep .* -- docs\/domains$/, SPEC],
      [/^git grep .* -- apps packages$/, tests],
    ],
  })
  return check(ctx)
}

test('passes when every example has a test, and writes the matrix', () => {
  const dir = mkdtempSync(join(tmpdir(), 'verification-'))
  try {
    const file = join(dir, 'verification.md')
    const tests = [
      "head:apps/api/src/companies/slug.test.ts:5:it('taken slug @id:companies-15-1', () => {",
      "head:apps/web/e2e/acceptance/landing.spec.ts:3:test('@id:public-site-20-1', () => {",
    ].join('\n')
    assert.deepEqual(run(tests, file).errors, [])
    const matrix = readFileSync(file, 'utf8')
    assert.match(matrix, /^## Verification/)
    assert.match(
      matrix,
      /\| `companies-15-1` \| docs\/domains\/companies.md:12 \| apps\/api\/src\/companies\/slug.test.ts \|/,
    )
    assert.doesNotMatch(matrix, /library-99-1/)
  } finally {
    rmSync(dir, { recursive: true, force: true })
  }
})

test('fails on an example without test and a test of a missing example', () => {
  const tests =
    "head:packages/domain/x.test.ts:9:it('@id:companies-15-1 @id:companies-15-9', () => {"
  const { errors } = run(tests)
  assert.deepEqual(errors, [
    'docs/domains/public-site.md:8: example @id:public-site-20-1 has no test',
    'packages/domain/x.test.ts:9: cites @id:companies-15-9, which no living spec has',
  ])
})

test('no examples and no tests pass', () => {
  const ctx = context({ routes: [[/^git grep/, failure(1)]] })
  assert.deepEqual(check(ctx).errors, [])
})
