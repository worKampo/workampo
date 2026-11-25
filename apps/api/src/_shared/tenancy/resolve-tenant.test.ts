import { describe, expect, it } from 'vitest'
import { resolveTenant } from './resolve-tenant'

const path = { mode: 'path' } as const
const stg = { mode: 'subdomain', hostSuffix: '-stg.workampo.test' } as const
const prod = { mode: 'subdomain', hostSuffix: '.workampo.test' } as const

describe('resolveTenant in path mode', () => {
  it('@id:companies-90-12 takes the slug from /api/t/<slug> and /c/<slug>, with or without more path', () => {
    for (const url of [
      'https://app.test/api/t/northwind/',
      'https://app.test/api/t/northwind',
      'https://app.test/api/t/northwind/members/01940000-0000-7000-8000-000000000001',
      'https://app.test/c/northwind',
      'https://app.test/c/northwind/',
      'https://app.test/c/northwind/team?tab=1',
      'https://app-stg.workers.test/c/northwind',
    ])
      expect(resolveTenant(url, path), url).toBe('northwind')
  })

  it('@id:companies-90-12 gives no slug outside the company prefixes', () => {
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
      expect(resolveTenant(url, path), url).toBeNull()
  })

  it('@id:companies-90-12 gives no slug when it breaks the slug rules', () => {
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
      expect(resolveTenant(`https://app.test/api/t/${slug}/`, path), slug).toBeNull()
  })

  it('@id:companies-90-12 never reads the slug from the host or the query in path mode', () => {
    expect(resolveTenant('https://northwind.workampo.test/api/me', path)).toBeNull()
    expect(
      resolveTenant('https://app.test/api/me?slug=northwind&tenant=northwind', path),
    ).toBeNull()
    expect(resolveTenant('https://app.test/api/t/sol-bakery/?slug=northwind', path)).toBe(
      'sol-bakery',
    )
  })
})

describe('resolveTenant in subdomain mode', () => {
  it('@id:companies-90-12 takes the slug from the host minus the environment suffix', () => {
    expect(resolveTenant('https://northwind-stg.workampo.test/app', stg)).toBe('northwind')
    expect(resolveTenant('https://northwind.workampo.test/app/team', prod)).toBe('northwind')
    // URLs lowercase their host.
    expect(resolveTenant('https://NorthWind.workampo.test/', prod)).toBe('northwind')
  })

  it('@id:companies-90-12 gives no slug for another host, the apex or a nested subdomain', () => {
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
      expect(resolveTenant(url, prod), url).toBeNull()
  })

  it('@id:companies-90-12 ignores the path in subdomain mode', () => {
    expect(resolveTenant('https://evil.test/c/northwind', prod)).toBeNull()
    expect(resolveTenant('https://evil.test/api/t/northwind/', stg)).toBeNull()
  })
})
