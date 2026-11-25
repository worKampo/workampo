import { describe, expect, it } from 'vitest'
import { tenantUrl as buildTenantUrl } from './tenant-url'

type Options = Parameters<typeof buildTenantUrl>[2]

function tenantUrl([slug, path]: [string, string], options: Options) {
  return buildTenantUrl(slug, path, options)
}

describe('tenantUrl in path mode', () => {
  it('@id:companies-90-1 builds <base>/c/<slug><path> with and without slashes at the joins', () => {
    for (const publicBaseUrl of ['https://app.workampo.test', 'https://app.workampo.test/']) {
      const options = { mode: 'path', publicBaseUrl } as const

      expect(tenantUrl(['northwind', '/'], options), publicBaseUrl).toBe(
        'https://app.workampo.test/c/northwind/',
      )
      expect(tenantUrl(['northwind', '/team'], options), publicBaseUrl).toBe(
        'https://app.workampo.test/c/northwind/team',
      )
      expect(tenantUrl(['northwind', 'team'], options), publicBaseUrl).toBe(
        'https://app.workampo.test/c/northwind/team',
      )
    }
  })

  it('@id:companies-90-1 keeps the port of a local base URL', () => {
    expect(
      tenantUrl(['northwind-logistics', '/'], {
        mode: 'path',
        publicBaseUrl: 'https://localhost:8789',
      }),
    ).toBe('https://localhost:8789/c/northwind-logistics/')
  })

  it('@id:companies-90-1 ignores the host suffix in path mode', () => {
    expect(
      tenantUrl(['sol', '/'], {
        mode: 'path',
        publicBaseUrl: 'https://app.workampo.test',
        hostSuffix: '.workampo.test',
      }),
    ).toBe('https://app.workampo.test/c/sol/')
  })
})

describe('tenantUrl in subdomain mode', () => {
  it('@id:companies-90-1 builds <protocol>//<slug><suffix>/app<path> for staging and production', () => {
    for (const publicBaseUrl of ['https://workampo.test', 'https://workampo.test/']) {
      expect(
        tenantUrl(['northwind', '/'], {
          mode: 'subdomain',
          publicBaseUrl,
          hostSuffix: '-stg.workampo.test',
        }),
      ).toBe('https://northwind-stg.workampo.test/app/')
      expect(
        tenantUrl(['northwind', 'team'], {
          mode: 'subdomain',
          publicBaseUrl,
          hostSuffix: '.workampo.test',
        }),
      ).toBe('https://northwind.workampo.test/app/team')
      expect(
        tenantUrl(['northwind', '/team'], {
          mode: 'subdomain',
          publicBaseUrl,
          hostSuffix: '.workampo.test',
        }),
      ).toBe('https://northwind.workampo.test/app/team')
    }
  })

  it('@id:companies-90-1 takes the protocol from the base URL', () => {
    expect(
      tenantUrl(['sol', '/'], {
        mode: 'subdomain',
        publicBaseUrl: 'http://workampo.test',
        hostSuffix: '.workampo.test',
      }),
    ).toBe('http://sol.workampo.test/app/')
  })
})
