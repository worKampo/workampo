import { describe, expect, it } from 'vitest'
import { parseEnv } from './env'
import type { AppEnv } from './http/app-env'

const rateLimits = {
  RATE_LIMIT_CODE_REQUESTS_PER_EMAIL: '3',
  RATE_LIMIT_CODE_REQUESTS_PER_IP: '30',
  RATE_LIMIT_CODE_ATTEMPTS_PER_EMAIL: '5',
  RATE_LIMIT_WINDOW_SECONDS: '900',
}
const bindings = (vars: Record<string, string>) => vars as unknown as AppEnv['Bindings']

describe('parseEnv', () => {
  it('reads the thresholds as numbers', () => {
    expect(parseEnv(bindings({ IDENTITY_PROVIDER: 'fake', ...rateLimits }))).toEqual({
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
})
