import { describe, expect, it } from 'vitest'

// tenant-url.ts arrives with the tenancy seam task; a non-literal path keeps typecheck green until
// then. Once it exists, import it statically.
const TENANT_URL: string = './tenant-url'
type Options = {
  mode: 'path' | 'subdomain'
  publicBaseUrl: string
  hostSuffix?: string | undefined
}
// biome-ignore lint/complexity/useMaxParams: the signature .work/plan.md gives tenantUrl.
type TenantUrl = (slug: string, path: string, options: Options) => string

async function tenantUrl([slug, path]: [string, string], options: Options) {
  const module: { tenantUrl: TenantUrl } = await import(TENANT_URL)

  return module.tenantUrl(slug, path, options)
}

describe('tenantUrl in path mode', () => {
  it.fails('@id:companies-90-1 builds <base>/c/<slug><path> with and without slashes at the joins', async () => {
    for (const publicBaseUrl of ['https://app.workampo.test', 'https://app.workampo.test/']) {
      const options = { mode: 'path', publicBaseUrl } as const

      expect(await tenantUrl(['northwind', '/'], options), publicBaseUrl).toBe(
        'https://app.workampo.test/c/northwind/',
      )
      expect(await tenantUrl(['northwind', '/team'], options), publicBaseUrl).toBe(
        'https://app.workampo.test/c/northwind/team',
      )
      expect(await tenantUrl(['northwind', 'team'], options), publicBaseUrl).toBe(
        'https://app.workampo.test/c/northwind/team',
      )
    }
  })

  it.fails('@id:companies-90-1 keeps the port of a local base URL', async () => {
    expect(
      await tenantUrl(['northwind-logistics', '/'], {
        mode: 'path',
        publicBaseUrl: 'https://localhost:8789',
      }),
    ).toBe('https://localhost:8789/c/northwind-logistics/')
  })

  it.fails('@id:companies-90-1 ignores the host suffix in path mode', async () => {
    expect(
      await tenantUrl(['sol', '/'], {
        mode: 'path',
        publicBaseUrl: 'https://app.workampo.test',
        hostSuffix: '.workampo.test',
      }),
    ).toBe('https://app.workampo.test/c/sol/')
  })
})

describe('tenantUrl in subdomain mode', () => {
  it.fails('@id:companies-90-1 builds <protocol>//<slug><suffix>/app<path> for staging and production', async () => {
    for (const publicBaseUrl of ['https://workampo.test', 'https://workampo.test/']) {
      expect(
        await tenantUrl(['northwind', '/'], {
          mode: 'subdomain',
          publicBaseUrl,
          hostSuffix: '-stg.workampo.test',
        }),
      ).toBe('https://northwind-stg.workampo.test/app/')
      expect(
        await tenantUrl(['northwind', 'team'], {
          mode: 'subdomain',
          publicBaseUrl,
          hostSuffix: '.workampo.test',
        }),
      ).toBe('https://northwind.workampo.test/app/team')
      expect(
        await tenantUrl(['northwind', '/team'], {
          mode: 'subdomain',
          publicBaseUrl,
          hostSuffix: '.workampo.test',
        }),
      ).toBe('https://northwind.workampo.test/app/team')
    }
  })

  it.fails('@id:companies-90-1 takes the protocol from the base URL', async () => {
    expect(
      await tenantUrl(['sol', '/'], {
        mode: 'subdomain',
        publicBaseUrl: 'http://workampo.test',
        hostSuffix: '.workampo.test',
      }),
    ).toBe('http://sol.workampo.test/app/')
  })
})
