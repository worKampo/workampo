import assert from 'node:assert/strict'
import { test } from 'node:test'
import { migrationNew, parseArgs } from './migration-new.mjs'

function fakeIo({ branch = 'feature/96-sign-in', existing = [], generates = [] } = {}) {
  const files = new Map(existing.map((name) => [name, 'old']))
  const calls = []
  return {
    calls,
    files,
    io: {
      branch: () => branch,
      listMigrations: () => [...files.keys()],
      drizzleKit: (args, kind) => {
        calls.push({ args, kind })
        for (const name of generates) files.set(name, 'CREATE TABLE `users` (\n);\n')
      },
      readFile: (name) => files.get(name),
      writeFile: (name, text) => files.set(name, text),
    },
  }
}

test('parses the database, the data flag and a verb_object name', () => {
  assert.deepEqual(parseArgs(['--global', 'create_users']), {
    kind: 'global',
    isData: false,
    name: 'create_users',
  })
  assert.deepEqual(parseArgs(['--shard', '--data', 'insert_plans']), {
    kind: 'shard',
    isData: true,
    name: 'insert_plans',
  })
})

test('rejects a missing database, both databases or a name that is not verb_object', () => {
  for (const argv of [
    ['create_users'],
    ['--global', '--shard', 'create_users'],
    ['--global'],
    ['--global', 'users'],
    ['--global', 'Create_users'],
    ['--global', 'create-users'],
    ['--global', 'create_users', 'extra'],
  ])
    assert.throws(() => parseArgs(argv), /Usage/, argv.join(' '))
})

test('generates the named migration and adds the ticket header from the branch', () => {
  const { io, calls, files } = fakeIo({
    existing: ['0000_create_users.sql'],
    generates: ['0001_create_identities.sql'],
  })

  const file = migrationNew({ kind: 'global', isData: false, name: 'create_identities' }, io)

  assert.equal(file, '0001_create_identities.sql')
  assert.deepEqual(calls, [{ args: ['generate', '--name=create_identities'], kind: 'global' }])
  assert.equal(files.get(file), '-- ticket: #96\nCREATE TABLE `users` (\n);\n')
  assert.equal(files.get('0000_create_users.sql'), 'old')
})

test('a data migration is an empty custom one', () => {
  const { io, calls } = fakeIo({ generates: ['0000_insert_plans.sql'] })

  migrationNew({ kind: 'shard', isData: true, name: 'insert_plans' }, io)

  assert.deepEqual(calls, [
    { args: ['generate', '--name=insert_plans', '--custom'], kind: 'shard' },
  ])
})

test('refuses a branch without a ticket before generating anything', () => {
  const { io, calls } = fakeIo({ branch: 'master', generates: ['0000_create_users.sql'] })

  assert.throws(
    () => migrationNew({ kind: 'global', isData: false, name: 'create_users' }, io),
    /no ticket/,
  )
  assert.deepEqual(calls, [])
})

test('fails when the schema has no changes', () => {
  const { io } = fakeIo({ existing: ['0000_create_users.sql'] })

  assert.throws(
    () => migrationNew({ kind: 'global', isData: false, name: 'create_users' }, io),
    /No migration was generated/,
  )
})
