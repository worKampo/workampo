import { describe, expect, it } from 'vitest'

// resolve-tenant.ts arrives with the tenancy seam task; a non-literal path keeps typecheck green
// until then. Once it exists, import it statically.
const RESOLVE_TENANT: string = './resolve-tenant'
type Options = { mode: 'path' | 'subdomain'; hostSuffix?: string | undefined }
type ResolveTenant = (url: string, options: Options) => string | null

async function resolveTenant(url: string, options: Options) {
  const module: { resolveTenant: ResolveTenant } = await import(RESOLVE_TENANT)

  return module.resolveTenant(url, options)
}

const path = { mode: 'path' } as const
const stg = { mode: 'subdomain', hostSuffix: '-stg.workampo.test' } as const
const prod = { mode: 'subdomain', hostSuffix: '.workampo.test' } as const

describe('resolveTenant in path mode', () => {
  it.fails('@id:companies-90-12 takes the slug from /api/t/<slug> and /c/<slug>, with or without more path', async () => {
    for (const url of [
      'https://app.test/api/t/northwind/',
      'https://app.test/api/t/northwind',
      'https://app.test/api/t/northwind/members/01940000-0000-7000-8000-000000000001',
      'https://app.test/c/northwind',
      'https://app.test/c/northwind/',
      'https://app.test/c/northwind/team?tab=1',
      'https://app-stg.workers.test/c/northwind',
    ])
      expect(await resolveTenant(url, path), url).toBe('northwind')
  })

  it.fails('@id:companies-90-12 gives no slug outside the company prefixes', async () => {
    for (const url of [
      'https://app.test/',
      'https://app.test/api/me',
      'https://app.test/api/t/',
      'https://app.test/api/tx/northwind',
      'https://app.test/c/',
      'https://app.test/cc/northwind',
      'https://app.test/x/c/northwind',
      'https://app.test/companies/new',
      'https://app.test/api/company-slugs/northwind',
    ])
      expect(await resolveTenant(url, path), url).toBeNull()
  })

  it.fails('@id:companies-90-12 gives no slug when it breaks the slug rules', async () => {
    for (const slug of [
      'api',
      'ab',
      'North',
      'mi--empresa',
      '-norte',
      'norte-stg',
      'sol%2Fbakery',
      'cl%C3%ADnica',
      'a'.repeat(41),
    ])
      expect(await resolveTenant(`https://app.test/api/t/${slug}/`, path), slug).toBeNull()
  })

  it.fails('@id:companies-90-12 never reads the slug from the host or the query in path mode', async () => {
    expect(await resolveTenant('https://northwind.workampo.test/api/me', path)).toBeNull()
    expect(
      await resolveTenant('https://app.test/api/me?slug=northwind&tenant=northwind', path),
    ).toBeNull()
    expect(await resolveTenant('https://app.test/api/t/sol-bakery/?slug=northwind', path)).toBe(
      'sol-bakery',
    )
  })
})

describe('resolveTenant in subdomain mode', () => {
  it.fails('@id:companies-90-12 takes the slug from the host minus the environment suffix', async () => {
    expect(await resolveTenant('https://northwind-stg.workampo.test/app', stg)).toBe('northwind')
    expect(await resolveTenant('https://northwind.workampo.test/app/team', prod)).toBe('northwind')
    // URLs lowercase their host.
    expect(await resolveTenant('https://NorthWind.workampo.test/', prod)).toBe('northwind')
  })

  it.fails('@id:companies-90-12 gives no slug for another host, the apex or a nested subdomain', async () => {
    for (const url of [
      'https://workampo.test/',
      'https://evil.test/',
      'https://northwind.workampo.test.evil.test/',
      'https://northwind.evil.test/?host=northwind.workampo.test',
      'https://a.northwind.workampo.test/',
      'https://api.workampo.test/',
      // A staging host read with the production suffix keeps "-stg", which no slug may end in.
      'https://northwind-stg.workampo.test/',
    ])
      expect(await resolveTenant(url, prod), url).toBeNull()
  })

  it.fails('@id:companies-90-12 ignores the path in subdomain mode', async () => {
    expect(await resolveTenant('https://evil.test/c/northwind', prod)).toBeNull()
    expect(await resolveTenant('https://evil.test/api/t/northwind/', stg)).toBeNull()
  })
})
