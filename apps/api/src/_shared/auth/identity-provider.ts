import type { VerifiedIdentity } from '@workampo/domain/access/identity'
import type { Language } from '@workampo/i18n'
import type { RequestOrigin } from '../http/request-origin'

// Our own seam over the identity provider (ADR-0071): it verifies who the person is, nothing more.
export type IdentityProvider = {
  startCodeSignIn(
    input: { email: string; locale: Language } & Partial<RequestOrigin>,
  ): Promise<void>
  completeCodeSignIn(
    input: { email: string; code: string } & Partial<RequestOrigin>,
  ): Promise<VerifiedIdentity>
  googleAuthorizationUrl(input: { state: string; redirectUri: string }): string
  completeGoogleSignIn(input: { code: string } & Partial<RequestOrigin>): Promise<VerifiedIdentity>
}

// Wrong or expired: the provider does not tell them apart, nor do we.
export class InvalidCodeError extends Error {}

export class ProviderUnavailableError extends Error {}
