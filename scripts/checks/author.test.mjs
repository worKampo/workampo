import assert from 'node:assert/strict'
import { test } from 'node:test'
import { check } from './author.mjs'
import { context, EMAIL, logOf, RENOVATE } from './test-support.mjs'

const other = ['someone', 'example.com'].join('@')
const ctxWith = (ref, commits) =>
  context({ env: { HEAD_REF: ref }, routes: [[/^git log/, logOf(commits)]] })

test('passes when every commit has the project noreply', () => {
  assert.deepEqual(check(ctxWith('feature/9-x', [{ sha: 'h1' }, { sha: 'h2' }])).errors, [])
})

test('fails on any other author', () => {
  const errors = check(
    ctxWith('feature/9-x', [{ sha: 'h1' }, { sha: 'h2bbbbb', email: other }]),
  ).errors
  assert.deepEqual(errors, [`h2bbbbb is authored by ${other}, not ${EMAIL}`])
})

test('Renovate is exempt only on its own branch', () => {
  const bot = { sha: 'r1', email: RENOVATE, name: 'renovate[bot]' }
  assert.deepEqual(check(ctxWith('renovate/all-minor', [bot])).errors, [])
  assert.equal(check(ctxWith('feature/9-x', [bot])).errors.length, 1)
})
