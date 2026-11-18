import assert from 'node:assert/strict'
import { test } from 'node:test'
import { emailErrors } from './emails.mjs'
import { EMAIL } from './test-support.mjs'

const at = '@'
const line = (text) => ({ file: 'a.ts', line: 3, text })

test('allows the project noreply, seed domains and package versions', () => {
  const lines = [
    line(`author: ${EMAIL}`),
    line(`ana${at}example.com seed${at}tenant.test`),
    line("import 'react@18.3.1'"),
    line(`workampo-dev${at}users.noreply.github.com 7+workampo-dev${at}users.noreply.github.com`),
  ]
  assert.deepEqual(emailErrors(lines, EMAIL), [])
})

test('fails on a real address and on another account noreply', () => {
  const lines = [line(`owner: someone${at}gmail.com`), line(`2+other${at}users.noreply.github.com`)]
  assert.deepEqual(emailErrors(lines, EMAIL), [
    `a.ts:3: email not allowed: someone${at}gmail.com`,
    `a.ts:3: email not allowed: 2+other${at}users.noreply.github.com`,
  ])
})
