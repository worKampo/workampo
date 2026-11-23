import { describe, expect, it } from 'vitest'
import { chooseProvider } from './choose-provider'

// ADR-0071: company demand, then a provider the user has, then the country rule, then the default.
const base = {
  userProviders: [] as string[],
  countryProviders: { ES: 'country' },
  defaultProvider: 'default',
}

describe('chooseProvider', () => {
  it('uses the provider a company demands before anything else', () => {
    expect(
      chooseProvider({
        ...base,
        companyProvider: 'company',
        userProviders: ['user'],
        country: 'ES',
      }),
    ).toBe('company')
  })

  it('keeps a provider the user already has', () => {
    expect(chooseProvider({ ...base, userProviders: ['user'], country: 'ES' })).toBe('user')
  })

  it('applies the country rule to a new person', () => {
    expect(chooseProvider({ ...base, country: 'ES' })).toBe('country')
  })

  it('falls back to the environment default', () => {
    expect(chooseProvider({ ...base, country: 'FR' })).toBe('default')
    expect(chooseProvider(base)).toBe('default')
  })

  it('in the MVP always returns workos', () => {
    expect(
      chooseProvider({ userProviders: [], countryProviders: {}, defaultProvider: 'workos' }),
    ).toBe('workos')
  })
})
