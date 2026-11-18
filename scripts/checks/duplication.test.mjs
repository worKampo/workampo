import assert from 'node:assert/strict'
import { writeFileSync } from 'node:fs'
import { join } from 'node:path'
import { test } from 'node:test'
import { check } from './duplication.mjs'
import { context, failure } from './test-support.mjs'

const clone = {
  firstFile: { name: 'apps\\web\\src\\a.tsx', start: 1, end: 13 },
  secondFile: { name: 'apps\\web\\src\\b.tsx', start: 4, end: 16 },
  lines: 13,
}

function ctxWith(duplicates) {
  return context({
    routes: [
      [
        /run-jscpd\.js --config \.jscpd\.json --output /,
        (args) => {
          const output = args[args.indexOf('--output') + 1]
          writeFileSync(join(output, 'jscpd-report.json'), JSON.stringify({ duplicates }))
          return ''
        },
      ],
    ],
  })
}

test('no clones, no warnings', () => {
  assert.deepEqual(check(ctxWith([])), { errors: [], warnings: [] })
})

test('clones are warnings, never errors', () => {
  assert.deepEqual(check(ctxWith([clone])), {
    errors: [],
    warnings: ['apps/web/src/a.tsx:1-13 duplicates apps/web/src/b.tsx:4-16 (13 lines)'],
  })
})

test('a jscpd crash is a warning, not a failure', () => {
  const ctx = context({ routes: [[/run-jscpd\.js/, failure(2)]] })
  assert.deepEqual(check(ctx), { errors: [], warnings: ['jscpd could not run: exit 2'] })
})
