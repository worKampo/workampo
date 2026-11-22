import { chooseProvider } from '@workampo/domain/access/choose-provider'
import type { IdentityProviderKey } from '@workampo/domain/access/identity'
import type { ParsedEnv } from '../env'
import { fakeProvider } from './fake-provider'
import { type IdentityProvider, ProviderUnavailableError } from './identity-provider'

const unavailable: IdentityProvider = {
  startCodeSignIn: () => Promise.reject(new ProviderUnavailableError()),
  completeCodeSignIn: () => Promise.reject(new ProviderUnavailableError()),
  googleAuthorizationUrl: () => {
    throw new ProviderUnavailableError()
  },
  completeGoogleSignIn: () => Promise.reject(new ProviderUnavailableError()),
}

const ADAPTERS: Record<IdentityProviderKey, (env: ParsedEnv) => IdentityProvider> = {
  workos: () => unavailable,
}

// The fake stands in for every provider, and only where the local vars name it.
export function identityProvider(env: ParsedEnv): IdentityProvider {
  if (env.IDENTITY_PROVIDER === 'fake') return fakeProvider
  const key = chooseProvider<IdentityProviderKey>({
    userProviders: [],
    countryProviders: {},
    defaultProvider: 'workos',
  })
  return ADAPTERS[key](env)
}
