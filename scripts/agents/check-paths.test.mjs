import assert from 'node:assert/strict'
import { test } from 'node:test'
import { fileURLToPath } from 'node:url'
import { missingPaths } from './check-paths.mjs'

const root = fileURLToPath(new URL('../..', import.meta.url))

test('reports links and repo paths that do not exist', () => {
  const text = 'See [x](docs/nope.md) and `docs/also-missing.md`.'
  assert.deepEqual(missingPaths(text, root, root), ['docs/nope.md', 'docs/also-missing.md'])
})

test('accepts existing paths and ignores non-paths', () => {
  const text =
    '[a](AGENTS.md#1-start-here) `scripts/github/app-token.mjs` `worKampo/business` `~/.workampo/` `@workampo/api` `**/e2e/acceptance/**` [w](https://example.com)'
  assert.deepEqual(missingPaths(text, root, root), [])
})

test('reports git-ignored paths, which CI does not have', () => {
  assert.deepEqual(missingPaths('`.claude/settings.local.json`', root, root), [
    '.claude/settings.local.json',
  ])
})
