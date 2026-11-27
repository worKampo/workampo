import assert from 'node:assert/strict'
import { execSync } from 'node:child_process'
import { test } from 'node:test'
import { fileURLToPath } from 'node:url'

const ROOT = fileURLToPath(new URL('../..', import.meta.url))

// The SPA version comes from the committed tree, the turbo cache key from the working tree: a cached
// build made before a commit would keep the older version (#201), so the web build is never cached.
test('turbo never caches the web build, so dist always carries the version of HEAD', () => {
  const plan = JSON.parse(
    execSync('pnpm exec turbo run build --filter=@workampo/web --dry=json', {
      cwd: ROOT,
      encoding: 'utf8',
    }),
  )
  const build = plan.tasks.find((task) => task.taskId === '@workampo/web#build')

  assert.equal(build?.resolvedTaskDefinition.cache, false)
  assert.deepEqual(build?.resolvedTaskDefinition.outputs, ['dist/**'])
})
