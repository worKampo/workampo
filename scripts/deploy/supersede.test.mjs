import assert from 'node:assert/strict'
import { test } from 'node:test'
import { runsToCancel } from './supersede.mjs'

test('only older runs still waiting are cancelled, never this one or a newer one', () => {
  const waiting = [{ databaseId: 10 }, { databaseId: 20 }, { databaseId: 30 }, { databaseId: 40 }]

  assert.deepEqual(runsToCancel({ waiting, currentId: 30 }), [10, 20])
})

test('nothing waiting, nothing cancelled', () => {
  assert.deepEqual(runsToCancel({ waiting: [], currentId: 30 }), [])
})
