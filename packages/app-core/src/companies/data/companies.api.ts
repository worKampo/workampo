import type { ApiClient } from '../../_shared/api-client'
import { send } from '../../_shared/api-error'

type SlugRoute = ApiClient['api']['t'][':slug']

export async function getCompanyContext(client: ApiClient, slug: string) {
  // hc drops the route's trailing slash under its typed `index` key; the empty key keeps it.
  const route = (client.api.t[':slug'] as unknown as Record<'', SlugRoute['index']>)['']
  const response = await send(() => route.$get({ param: { slug } }))

  return await response.json()
}
