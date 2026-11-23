// The production build fails if it includes the fake identity provider (ADR-0029).
//   node scripts/build/no-fake-provider.mjs <bundle dir>
import { readdirSync, readFileSync } from 'node:fs'
import { join } from 'node:path'
import { pathToFileURL } from 'node:url'

// The same text as MARK in apps/api/src/_shared/identity/fake-provider.ts.
export const FAKE_PROVIDER_MARK = 'workampo-fake-identity-provider'

export function assertNoFakeProvider(dir) {
  const found = readdirSync(dir, { recursive: true })
    .filter((file) => file.endsWith('.js'))
    .filter((file) => readFileSync(join(dir, file), 'utf8').includes(FAKE_PROVIDER_MARK))

  if (found.length > 0)
    throw new Error(`The bundle includes the fake identity provider: ${found.join(', ')}`)
}

if (process.argv[1] && import.meta.url === pathToFileURL(process.argv[1]).href) {
  try {
    assertNoFakeProvider(process.argv[2] ?? 'dist')
  } catch (error) {
    console.error(error.message)
    process.exit(1)
  }
}
