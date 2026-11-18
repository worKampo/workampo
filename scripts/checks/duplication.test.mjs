import assert from 'node:assert/strict'
import { writeFileSync } from 'node:fs'
import { tmpdir } from 'node:os'
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
  const missing = context({
    routes: [[/run-jscpd\.js/, failure(1, '\nNo jscpd binary for this platform\nmore')]],
  })
  assert.deepEqual(check(missing).warnings, [
    'jscpd could not run: No jscpd binary for this platform',
  ])
})

test('a temporary directory that cannot be created is a warning, not a failure', () => {
  const tmp = process.env.TMPDIR
  const temp = process.env.TEMP
  const tmpVar = process.env.TMP
  const nowhere = join(tmpdir(), 'missing-parent', 'deeper')
  process.env.TMPDIR = process.env.TEMP = process.env.TMP = nowhere
  try {
    const result = check(ctxWith([]))
    assert.deepEqual(result.errors, [])
    assert.match(result.warnings[0], /^jscpd could not run: ENOENT/)
  } finally {
    for (const [key, value] of [
      ['TMPDIR', tmp],
      ['TEMP', temp],
      ['TMP', tmpVar],
    ])
      if (value === undefined) delete process.env[key]
      else process.env[key] = value
  }
})
