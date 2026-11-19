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

function run(tests, file, spec = SPEC) {
  const ctx = context({
    env: { VERIFICATION_FILE: file },
    routes: [
      [/^git grep .* -- docs\/domains$/, spec],
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
    assert.match(matrix, /^## Verification\n\nVerified commit: head\n/)
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

test('a malformed @id in a spec or a test fails', () => {
  const tests = [
    "head:packages/domain/x.test.ts:9:it('@id:companies-15-1 @id:public-site-20-1', () => {",
    "head:packages/domain/y.test.ts:3:it.fails('@id:companies-<issue>-<n> @id:Companies-15-1')",
  ].join('\n')
  const spec = [
    SPEC,
    'head:docs/domains/README.md:47:| `@id:<domain>-<issue>-<n>` | On each example |',
    'head:docs/domains/companies.md:20:    @id:companies-15-x',
  ].join('\n')
  assert.deepEqual(run(tests, undefined, spec).errors, [
    'docs/domains/companies.md:20: malformed @id:companies-15-x',
    'packages/domain/y.test.ts:3: malformed @id:companies-<issue>-<n>',
    'packages/domain/y.test.ts:3: malformed @id:Companies-15-1',
  ])
})

test('an @id with a valid prefix and a bad suffix is malformed and cites nothing', () => {
  const tests =
    "head:packages/domain/x.test.ts:9:it('@id:companies-15-1é @id:public-site-20-1 t', () => {"
  assert.deepEqual(run(tests).errors, [
    'packages/domain/x.test.ts:9: malformed @id:companies-15-1é',
    'docs/domains/companies.md:12: example @id:companies-15-1 has no test',
  ])
})
