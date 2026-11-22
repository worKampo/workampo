export type IdentityProviderKey = 'workos'

export type VerifiedIdentity = {
  provider: IdentityProviderKey
  // The user's id at the provider.
  subject: string
  email: string
  isEmailVerified: boolean
}
