import { describe, expect, it } from 'vitest'
import type { ParsedEnv } from '../env'
import { fakeProvider } from './fake-provider'
import { identityProvider } from './provider-registry'

const rateLimits = {
  RATE_LIMIT_CODE_REQUESTS_PER_EMAIL: 1,
  RATE_LIMIT_CODE_REQUESTS_PER_IP: 1,
  RATE_LIMIT_CODE_ATTEMPTS_PER_EMAIL: 1,
  RATE_LIMIT_COMPANY_CREATES_PER_USER: 1,
  RATE_LIMIT_COMPANY_CREATES_PER_IP: 1,
  RATE_LIMIT_WINDOW_SECONDS: 1,
  TENANT_ROUTING: 'path' as const,
  PUBLIC_BASE_URL: 'https://app.test',
}

describe('identityProvider', () => {
  it('is the fake only where the environment names it', () => {
    expect(identityProvider({ IDENTITY_PROVIDER: 'fake', ...rateLimits })).toBe(fakeProvider)
  })

  it('is never the fake without that variable', () => {
    const env: ParsedEnv = {
      IDENTITY_PROVIDER: 'workos',
      WORKOS_API_KEY: 'test-key',
      WORKOS_CLIENT_ID: 'test-client',
      ...rateLimits,
    }
    expect(() => identityProvider(env)).not.toThrow(/fake/)
    expect(identityProvider(env)).not.toBe(fakeProvider)
  })
})
