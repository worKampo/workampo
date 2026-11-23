// Scaffolds apps/api/src/<domain>/<feature>/<use-case>/<use-case>.int.test.ts and never overwrites (ADR-0029).
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

export function newTest(path, root = ROOT) {
  const parts = (path ?? '').split('/')
  if (parts.length !== 3) throw new Error(`"${path}" is not <domain>/<feature>/<use-case>`)
  for (const part of parts) if (!KEBAB.test(part)) throw new Error(`"${part}" is not kebab-case`)
  const [domain, , useCase] = parts
  const file = join(root, 'apps/api/src', ...parts, `${useCase}.int.test.ts`)
  if (existsSync(file)) throw new Error(`${file} already exists`)
  mkdirSync(dirname(file), { recursive: true })
  writeFileSync(file, template(domain))
  return file
}

if (process.argv[1] === fileURLToPath(import.meta.url)) {
  try {
    console.log(`created ${newTest(process.argv[2])}`)
  } catch (error) {
    console.error(`${error.message}\nusage: test:new <domain>/<feature>/<use-case>`)
    process.exit(1)
  }
}
