import assert from 'node:assert/strict'
import { existsSync, mkdtempSync, readFileSync, rmSync } from 'node:fs'
import { tmpdir } from 'node:os'
import { join } from 'node:path'
import { test } from 'node:test'
import { newTest } from './test-new.mjs'

test('writes the template and refuses to overwrite', () => {
  const root = mkdtempSync(join(tmpdir(), 'test-new-'))
  try {
    const file = newTest('companies/invitations/invite-member', root)
    assert.ok(
      file.endsWith(
        join(
          'apps',
          'api',
          'src',
          'companies',
          'invitations',
          'invite-member',
          'invite-member.int.test.ts',
        ),
      ),
    )
    const text = readFileSync(file, 'utf8')
    assert.match(text, /it\.fails\('@id:companies-/)
    assert.throws(() => newTest('companies/invitations/invite-member', root), /already exists/)
  } finally {
    rmSync(root, { recursive: true })
  }
})

test('rejects names that are not kebab-case and writes nothing', () => {
  const root = mkdtempSync(join(tmpdir(), 'test-new-'))
  try {
    assert.throws(() => newTest('Companies/invitations/x', root), /kebab-case/)
    assert.throws(() => newTest('companies/../x', root), /kebab-case/)
    assert.throws(() => newTest('companies/invite-member', root), /<domain>\/<feature>\/<use-case>/)
    assert.equal(existsSync(join(root, 'apps')), false)
  } finally {
    rmSync(root, { recursive: true })
  }
})
