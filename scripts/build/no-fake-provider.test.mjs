import assert from 'node:assert/strict'
import { mkdirSync, mkdtempSync, writeFileSync } from 'node:fs'
import { tmpdir } from 'node:os'
import { join } from 'node:path'
import { test } from 'node:test'
import { assertNoFakeProvider, FAKE_PROVIDER_MARK } from './no-fake-provider.mjs'

function bundle(files) {
  const dir = mkdtempSync(join(tmpdir(), 'bundle-'))
  for (const [name, text] of Object.entries(files)) {
    mkdirSync(join(dir, name, '..'), { recursive: true })
    writeFileSync(join(dir, name), text)
  }

  return dir
}

test('a bundle without the fake provider passes', () => {
  const dir = bundle({ 'index.js': 'export default {}', 'index.js.map': FAKE_PROVIDER_MARK })

  assert.doesNotThrow(() => assertNoFakeProvider(dir))
})

test('a bundle with the fake provider fails and names the file', () => {
  const dir = bundle({ 'chunks/a.js': `throw new Error("${FAKE_PROVIDER_MARK}: wrong code")` })

  assert.throws(() => assertNoFakeProvider(dir), /fake identity provider.*a\.js/)
})

test('a missing bundle fails instead of passing', () => {
  assert.throws(() => assertNoFakeProvider(join(tmpdir(), 'no-such-bundle-dir')))
})
