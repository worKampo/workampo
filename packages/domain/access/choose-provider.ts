// The order of ADR-0071. Generic over the key so the order is testable with one real provider.
export function chooseProvider<P extends string>(input: {
  companyProvider?: P
  userProviders: readonly P[]
  country?: string
  countryProviders: Partial<Record<string, P>>
  defaultProvider: P
}): P {
  return (
    input.companyProvider ??
    input.userProviders[0] ??
    (input.country === undefined ? undefined : input.countryProviders[input.country]) ??
    input.defaultProvider
  )
}
