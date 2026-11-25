import type { ApiClient } from '../../_shared/api-client'
import { send } from '../../_shared/api-error'

type SlugRoute = ApiClient['api']['t'][':slug']
type CreateCompanyInput = { name: string; slug: string; defaultLanguage: string; userName?: string }

// biome-ignore lint/complexity/useMaxParams: the key is a header, kept apart from the body it guards.
export async function createCompany(
  client: ApiClient,
  input: CreateCompanyInput,
  idempotencyKey: string,
) {
  const response = await send(() =>
    client.api.companies.$post({ json: input, header: { 'idempotency-key': idempotencyKey } }),
  )

  return await response.json()
}

export async function checkSlug(client: ApiClient, slug: string) {
  const response = await send(() => client.api.companies.availability.$get({ query: { slug } }))

  return await response.json()
}

export async function getCompanyContext(client: ApiClient, slug: string) {
  // hc drops the route's trailing slash under its typed `index` key; the empty key keeps it.
  const route = (client.api.t[':slug'] as unknown as Record<'', SlugRoute['index']>)['']
  const response = await send(() => route.$get({ param: { slug } }))

  return await response.json()
}
