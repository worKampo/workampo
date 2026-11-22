import type { VerifiedIdentity } from '@workampo/domain/access/identity'
import { z } from 'zod'
import type { RequestOrigin } from '../http/request-origin'
import {
  type IdentityProvider,
  InvalidCodeError,
  ProviderUnavailableError,
} from './identity-provider'

const API = 'https://api.workos.com/user_management'

// Only what we keep: tokens and the rest of the answer are dropped (ADR-0071).
const authenticateAnswerSchema = z.object({
  user: z.object({ id: z.string(), email: z.string(), email_verified: z.boolean() }),
})

export function workosProvider({
  apiKey,
  clientId,
  fetch = (input, init) => globalThis.fetch(input, init),
}: {
  apiKey: string
  clientId: string
  fetch?: typeof globalThis.fetch
}): IdentityProvider {
  async function post(path: string, body: Record<string, unknown>) {
    try {
      return await fetch(`${API}${path}`, {
        method: 'POST',
        headers: { Authorization: `Bearer ${apiKey}`, 'Content-Type': 'application/json' },
        body: JSON.stringify(body),
      })
    } catch (cause) {
      throw new ProviderUnavailableError('WorkOS did not answer', { cause })
    }
  }

  async function authenticate(body: Record<string, unknown>): Promise<VerifiedIdentity> {
    const response = await post('/authenticate', {
      client_id: clientId,
      client_secret: apiKey,
      ...body,
    })

    // WorkOS rejects a wrong or expired code with 400 (invalid_grant).
    if (response.status === 400) throw new InvalidCodeError()
    const answer = response.ok
      ? authenticateAnswerSchema.safeParse(await response.json().catch(() => null))
      : null

    if (!answer?.success) throw new ProviderUnavailableError(`WorkOS answered ${response.status}`)
    const { user } = answer.data

    return {
      provider: 'workos',
      subject: user.id,
      email: user.email,
      isEmailVerified: user.email_verified,
    }
  }

  return {
    // WorkOS renders the email in en, es and ca alike (its supported locales, consulted 2026-11-22).
    async startCodeSignIn({ email, locale, ...origin }) {
      const response = await post('/magic_auth', { email, locale, ...originFields(origin) })

      // The answer holds the code itself: it is never read, so it cannot leave this function.
      if (!response.ok) throw new ProviderUnavailableError(`WorkOS answered ${response.status}`)
    },

    completeCodeSignIn: ({ email, code, ...origin }) =>
      authenticate({
        grant_type: 'urn:workos:oauth:grant-type:magic-auth:code',
        code,
        email,
        ...originFields(origin),
      }),

    googleAuthorizationUrl({ state, redirectUri }) {
      const url = new URL(`${API}/authorize`)
      url.search = new URLSearchParams({
        response_type: 'code',
        client_id: clientId,
        redirect_uri: redirectUri,
        provider: 'GoogleOAuth',
        state,
      }).toString()

      return url.href
    },

    completeGoogleSignIn: ({ code, ...origin }) =>
      authenticate({ grant_type: 'authorization_code', code, ...originFields(origin) }),
  }
}

const originFields = ({ ipAddress, userAgent }: Partial<RequestOrigin>) => ({
  ...(ipAddress && { ip_address: ipAddress }),
  ...(userAgent && { user_agent: userAgent }),
})
