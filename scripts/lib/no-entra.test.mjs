import assert from 'node:assert/strict'
import { test } from 'node:test'
import { findNoEntra } from './no-entra.mjs'

// Samples are assembled at runtime so this file does not itself trip the write hook.
const at = '@'

test('blocks a GitHub token', () => {
  assert.ok(findNoEntra(`token: ghp_${'a1B2'.repeat(9)}`).length)
})

test('blocks a private key', () => {
  assert.ok(findNoEntra(`-----BEGIN ${'RSA PRIVATE'} KEY-----`).length)
})

test('blocks a real email', () => {
  assert.deepEqual(findNoEntra(`owner: someone${at}gmail.com`), [
    `email not allowed: someone${at}gmail.com`,
  ])
})

test('allows the project noreply, seed and package-version addresses', () => {
  const text = [
    `1+dev${at}users.noreply.github.com`,
    `dev${at}users.noreply.github.com`,
    `ana${at}example.com`,
    `ops${at}example.org`,
    `seed${at}tenant.test`,
    'react@18.3.1',
  ].join('\n')
  assert.deepEqual(findNoEntra(text, `1+dev${at}users.noreply.github.com`), [])
})

test("blocks another account's noreply, and any noreply when the project's is unknown", () => {
  const other = `2+someone${at}users.noreply.github.com`

  assert.deepEqual(findNoEntra(other, `1+dev${at}users.noreply.github.com`), [
    `email not allowed: ${other}`,
  ])
  assert.deepEqual(findNoEntra(other), [`email not allowed: ${other}`])
})

test('allows paths and hex hashes', () => {
  assert.deepEqual(
    findNoEntra(
      'packages/domain/src/reservations/booking-window-rules.ts 3f2a9c0b1d4e5f60718293a4b5c6d7e8f9012345',
    ),
    [],
  )
})
