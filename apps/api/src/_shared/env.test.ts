import { describe, expect, it } from 'vitest'
import type { Bindings } from './env'
import { parseEnv } from './env'

const rateLimits = {
  RATE_LIMIT_CODE_REQUESTS_PER_EMAIL: '3',
  RATE_LIMIT_CODE_REQUESTS_PER_IP: '30',
  RATE_LIMIT_CODE_ATTEMPTS_PER_EMAIL: '5',
  RATE_LIMIT_WINDOW_SECONDS: '900',
  RATE_LIMIT_COMPANY_CREATES_PER_USER: '4',
  RATE_LIMIT_COMPANY_CREATES_PER_IP: '40',
  TENANT_ROUTING: 'path',
  PUBLIC_BASE_URL: 'https://app.test',
}
const bindings = (vars: Record<string, string>) => vars as unknown as Bindings

describe('parseEnv', () => {
  it('reads the thresholds as numbers', () => {
    expect(parseEnv(bindings({ IDENTITY_PROVIDER: 'fake', ...rateLimits }))).toMatchObject({
      IDENTITY_PROVIDER: 'fake',
      RATE_LIMIT_CODE_REQUESTS_PER_EMAIL: 3,
      RATE_LIMIT_CODE_REQUESTS_PER_IP: 30,
      RATE_LIMIT_CODE_ATTEMPTS_PER_EMAIL: 5,
      RATE_LIMIT_WINDOW_SECONDS: 900,
    })
  })

  it('uses WorkOS when no provider is named, and then needs its key and client id', () => {
    expect(() => parseEnv(bindings(rateLimits))).toThrow()
    const env = parseEnv(
      bindings({ WORKOS_API_KEY: 'test-key', WORKOS_CLIENT_ID: 'test-client', ...rateLimits }),
    )
    expect(env).toMatchObject({ IDENTITY_PROVIDER: 'workos', WORKOS_CLIENT_ID: 'test-client' })
  })

  it('rejects a missing, zero or non-numeric threshold and an unknown provider', () => {
    for (const vars of [
      { IDENTITY_PROVIDER: 'fake' },
      { IDENTITY_PROVIDER: 'fake', ...rateLimits, RATE_LIMIT_WINDOW_SECONDS: '0' },
      { IDENTITY_PROVIDER: 'fake', ...rateLimits, RATE_LIMIT_CODE_REQUESTS_PER_IP: 'many' },
      { IDENTITY_PROVIDER: 'other', ...rateLimits },
    ])
      expect(() => parseEnv(bindings(vars))).toThrow()
  })

  it('never puts a secret in its error', () => {
    const error = (() => {
      try {
        parseEnv(bindings({ WORKOS_API_KEY: 'test-secret-value', ...rateLimits }))
      } catch (caught) {
        return String(caught)
      }
    })()
    expect(error).toBeDefined()
    expect(error).not.toContain('test-secret-value')
  })

  it('@id:companies-90-1 reads the tenancy configuration and the company-create thresholds', () => {
    expect(parseEnv(bindings({ IDENTITY_PROVIDER: 'fake', ...rateLimits }))).toMatchObject({
      TENANT_ROUTING: 'path',
      PUBLIC_BASE_URL: 'https://app.test',
      RATE_LIMIT_COMPANY_CREATES_PER_USER: 4,
      RATE_LIMIT_COMPANY_CREATES_PER_IP: 40,
    })
  })

  it('@id:companies-90-1 needs TENANT_HOST_SUFFIX only in subdomain mode', () => {
    const subdomain = { IDENTITY_PROVIDER: 'fake', ...rateLimits, TENANT_ROUTING: 'subdomain' }

    expect(() => parseEnv(bindings(subdomain))).toThrow()
    expect(
      parseEnv(bindings({ ...subdomain, TENANT_HOST_SUFFIX: '-stg.workampo.test' })),
    ).toMatchObject({ TENANT_ROUTING: 'subdomain', TENANT_HOST_SUFFIX: '-stg.workampo.test' })
    expect(parseEnv(bindings({ IDENTITY_PROVIDER: 'fake', ...rateLimits }))).toMatchObject({
      TENANT_ROUTING: 'path',
    })
  })

  it('@id:companies-90-1 rejects an unknown routing mode, a base URL that is not one and a missing company-create threshold', () => {
    const { RATE_LIMIT_COMPANY_CREATES_PER_USER: _, ...withoutUserLimit } = rateLimits
    for (const vars of [
      { IDENTITY_PROVIDER: 'fake', ...rateLimits, TENANT_ROUTING: 'header' },
      { IDENTITY_PROVIDER: 'fake', ...rateLimits, PUBLIC_BASE_URL: 'not a url' },
      { IDENTITY_PROVIDER: 'fake', ...rateLimits, RATE_LIMIT_COMPANY_CREATES_PER_IP: '0' },
      { IDENTITY_PROVIDER: 'fake', ...withoutUserLimit },
    ])
      expect(() => parseEnv(bindings(vars))).toThrow()
  })
})
