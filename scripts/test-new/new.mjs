// Scaffolds apps/api/src/<domain>/<name>.int.test.ts and never overwrites (ADR-0029).
import { existsSync, mkdirSync, writeFileSync } from 'node:fs'
import { dirname, join } from 'node:path'
import { fileURLToPath } from 'node:url'

const ROOT = fileURLToPath(new URL('../..', import.meta.url))
const KEBAB = /^[a-z][a-z0-9]*(-[a-z0-9]+)*$/

const template = (domain) => `import { exports } from 'cloudflare:workers'
import { expect, it } from 'vitest'

it.fails('@id:${domain}-<issue>-<n> replace with the example text', async () => {
  const response = await exports.default.fetch('https://app.test/health')

  expect(response.status).toBe(418)
})
`

export function newTest(domain, name, root = ROOT) {
  for (const part of [domain, name])
    if (!KEBAB.test(part ?? '')) throw new Error(`"${part}" is not kebab-case`)
  const file = join(root, 'apps/api/src', domain, `${name}.int.test.ts`)
  if (existsSync(file)) throw new Error(`${file} already exists`)
  mkdirSync(dirname(file), { recursive: true })
  writeFileSync(file, template(domain))
  return file
}

if (process.argv[1] === fileURLToPath(import.meta.url)) {
  try {
    console.log(`created ${newTest(process.argv[2], process.argv[3])}`)
  } catch (error) {
    console.error(`${error.message}\nusage: test:new <domain> <name>`)
    process.exit(1)
  }
}
