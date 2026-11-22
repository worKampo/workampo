import type { IdentityProviderKey } from '@workampo/domain/access/identity'
import { chooseProvider } from '@workampo/domain/access/sign-in/choose-provider'
import type { ParsedEnv } from '../env'
import { fakeProvider } from './fake-provider'
import type { IdentityProvider } from './identity-provider'
import { workosProvider } from './workos-provider'

type ProviderEnv = Exclude<ParsedEnv, { IDENTITY_PROVIDER: 'fake' }>

const ADAPTERS: Record<IdentityProviderKey, (env: ProviderEnv) => IdentityProvider> = {
  workos: (env) => workosProvider({ apiKey: env.WORKOS_API_KEY, clientId: env.WORKOS_CLIENT_ID }),
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
