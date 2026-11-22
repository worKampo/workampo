import { describe, expect, it } from 'vitest'
import { InvalidCodeError, ProviderUnavailableError } from './identity-provider'
import { identityProviderContract } from './identity-provider.contract'
import { workosProvider } from './workos-provider'

type Call = { url: string; init: RequestInit; body: Record<string, unknown> }

const workosUser = { id: 'user_01', email: 'ana@example.com', email_verified: true }

identityProviderContract({
  name: 'WorkOS',
  makeProvider: () => fakeWorkos(workosAnswers).provider,
  email: 'ana@example.com',
  validCode: '123456',
  invalidCode: '111111',
})

const origin = { ipAddress: '192.0.2.1', userAgent: 'Browser/1.0' }

describe('workosProvider', () => {
  it('@id:access-96-1 asks WorkOS to email a code with our locale, and drops the code', async () => {
    const { calls, provider } = fakeWorkos(workosAnswers)

    const result = await provider.startCodeSignIn({
      email: 'ana@example.com',
      locale: 'ca',
      ...origin,
    })

    expect(result).toBeUndefined()
    expect(calls).toHaveLength(1)
    expect(calls[0]?.url).toBe('https://api.workos.com/user_management/magic_auth')
    expect(calls[0]?.init.method).toBe('POST')
    expect(new Headers(calls[0]?.init.headers).get('Authorization')).toBe('Bearer test-key')
    expect(calls[0]?.body).toEqual({
      email: 'ana@example.com',
      locale: 'ca',
      ip_address: '192.0.2.1',
      user_agent: 'Browser/1.0',
    })
  })

  it('@id:access-96-2 authenticates the code and keeps only the identity', async () => {
    const { calls, provider } = fakeWorkos(workosAnswers)

    const identity = await provider.completeCodeSignIn({
      email: 'ana@example.com',
      code: '123456',
      ...origin,
    })

    expect(identity).toEqual({
      provider: 'workos',
      subject: 'user_01',
      email: 'ana@example.com',
      isEmailVerified: true,
    })
    expect(calls[0]?.url).toBe('https://api.workos.com/user_management/authenticate')
    expect(calls[0]?.body).toEqual({
      client_id: 'test-client',
      client_secret: 'test-key',
      grant_type: 'urn:workos:oauth:grant-type:magic-auth:code',
      code: '123456',
      email: 'ana@example.com',
      ip_address: '192.0.2.1',
      user_agent: 'Browser/1.0',
    })
  })

  it('@id:access-96-9 reports an unverified email as such', async () => {
    const { provider } = fakeWorkos(() =>
      Response.json({ user: { ...workosUser, email_verified: false } }),
    )

    expect(
      await provider.completeCodeSignIn({ email: 'ana@example.com', code: '123456' }),
    ).toMatchObject({ isEmailVerified: false })
  })

  it('@id:access-96-3 a rejected code is an InvalidCodeError', async () => {
    const { provider } = fakeWorkos(workosAnswers)

    await expect(
      provider.completeCodeSignIn({ email: 'ana@example.com', code: '000000' }),
    ).rejects.toBeInstanceOf(InvalidCodeError)
  })

  it('a WorkOS failure, an unexpected answer or no network is ProviderUnavailableError', async () => {
    const failures = [
      () => new Response('down', { status: 503 }),
      () => Response.json({ unexpected: true }),
      () => {
        throw new TypeError('network')
      },
    ]
    for (const answer of failures)
      await expect(
        fakeWorkos(answer).provider.completeCodeSignIn({ email: 'a@example.com', code: '123456' }),
      ).rejects.toBeInstanceOf(ProviderUnavailableError)
    await expect(
      fakeWorkos(failures[0]).provider.startCodeSignIn({ email: 'a@example.com', locale: 'en' }),
    ).rejects.toBeInstanceOf(ProviderUnavailableError)
  })

  it('@id:access-96-6 sends the browser to WorkOS Google with our state and callback', () => {
    const url = new URL(
      fakeWorkos().provider.googleAuthorizationUrl({
        state: 'state-123',
        redirectUri: 'https://app.test/api/sessions/google/callback',
      }),
    )

    expect(url.origin + url.pathname).toBe('https://api.workos.com/user_management/authorize')
    expect(Object.fromEntries(url.searchParams)).toEqual({
      response_type: 'code',
      client_id: 'test-client',
      redirect_uri: 'https://app.test/api/sessions/google/callback',
      provider: 'GoogleOAuth',
      state: 'state-123',
    })
  })

  it('@id:access-96-6 exchanges the Google code for the identity', async () => {
    const { calls, provider } = fakeWorkos(workosAnswers)

    const identity = await provider.completeGoogleSignIn({ code: 'google-code', ...origin })

    expect(identity.subject).toBe('user_01')
    expect(calls[0]?.body).toEqual({
      client_id: 'test-client',
      client_secret: 'test-key',
      grant_type: 'authorization_code',
      code: 'google-code',
      ip_address: '192.0.2.1',
      user_agent: 'Browser/1.0',
    })
  })
})

// A test fetch that answers like WorkOS: never a module mock.
function fakeWorkos(answer: (call: Call) => Response = () => Response.json({})) {
  const calls: Call[] = []
  const fetch = async (input: RequestInfo | URL, init: RequestInit = {}) => {
    const call = { url: String(input), init, body: JSON.parse(String(init.body ?? '{}')) }
    calls.push(call)
    return answer(call)
  }
  return { calls, provider: workosProvider({ apiKey: 'test-key', clientId: 'test-client', fetch }) }
}

const workosAnswers = ({ url, body }: Call) => {
  if (url.endsWith('/user_management/magic_auth'))
    return Response.json({ id: 'magic_auth_01', email: body.email, code: '987654' })
  if (body.code === '123456' || body.code === 'google-code')
    return Response.json({
      user: workosUser,
      access_token: 'access',
      refresh_token: 'refresh',
      oauth_tokens: { access_token: 'google' },
    })
  return Response.json(
    { error: 'invalid_grant', error_description: 'Invalid code' },
    { status: 400 },
  )
}
