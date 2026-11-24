import { env } from 'cloudflare:workers'
import { describe, expect, it } from 'vitest'
import type { IdentityProvider } from '../../../_shared/identity/identity-provider'
import { newEmail, newIp } from '../../../_shared/testing/api-requests'
import { AccessError } from '../../errors'
import { startCodeSignIn } from './start-code.logic'

const LIMITS = { perEmail: 2, perIp: 3, windowSeconds: 600 }

describe('startCodeSignIn', () => {
  it('@id:access-96-1 asks the provider to email a code in the language of the request', async () => {
    const { provider, requests } = recordingProvider()
    const email = newEmail()

    await startCodeSignIn(env, {
      provider,
      limits: LIMITS,
      request: { email, locale: 'ca', ipAddress: newIp(), userAgent: 'Browser/1.0' },
    })

    expect(requests).toEqual([
      { email, locale: 'ca', ipAddress: expect.any(String), userAgent: 'Browser/1.0' },
    ])
  })

  it('@id:access-96-5 past the limit per email the code is not sent', async () => {
    const { provider, requests } = recordingProvider()
    const email = newEmail()
    for (let i = 0; i < LIMITS.perEmail; i++)
      await startCodeSignIn(env, { provider, limits: LIMITS, request: requestOf(email) })

    const third = startCodeSignIn(env, { provider, limits: LIMITS, request: requestOf(email) })

    await expect(third).rejects.toEqual(new AccessError('access.too_many_code_requests'))
    expect(requests).toHaveLength(LIMITS.perEmail)
  })

  it('@id:access-96-5 past the limit per IP the code is not sent', async () => {
    const { provider, requests } = recordingProvider()
    const ipAddress = newIp()
    for (let i = 0; i < LIMITS.perIp; i++)
      await startCodeSignIn(env, {
        provider,
        limits: LIMITS,
        request: { ...requestOf(newEmail()), ipAddress },
      })

    const next = startCodeSignIn(env, {
      provider,
      limits: LIMITS,
      request: { ...requestOf(newEmail()), ipAddress },
    })

    await expect(next).rejects.toEqual(new AccessError('access.too_many_code_requests'))
    expect(requests).toHaveLength(LIMITS.perIp)
  })
})

function recordingProvider() {
  const requests: unknown[] = []
  const provider = {
    startCodeSignIn: async (request: unknown) => {
      requests.push(request)
    },
  } as unknown as IdentityProvider

  return { provider, requests }
}

function requestOf(email: string) {
  return { email, locale: 'en' as const, ipAddress: newIp() }
}
