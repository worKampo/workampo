import { hashKey, type QueryClient, queryOptions, useQuery } from '@tanstack/react-query'
import type { ApiClient } from '../_shared/api-client'
import { useApiClient } from '../_shared/api-client-context'
import { ME_QUERY_KEY } from './data/query-keys'
import { getMe } from './data/session.api'

// Also for the router's guard, which runs outside React.
export function meQueryOptions(client: ApiClient) {
  return queryOptions({ queryKey: ME_QUERY_KEY, queryFn: () => getMe(client) })
}

export function useMe() {
  return useQuery(meQueryOptions(useApiClient()))
}

// Nothing cached under the previous session may reach the next person on the device; in-flight requests
// are cancelled so they cannot write it back. Me is overwritten, not removed, so its observers see the change.
export async function replaceSession(
  queryClient: QueryClient,
  me: { id: string; email: string } | null,
) {
  await queryClient.cancelQueries()
  queryClient.removeQueries({ predicate: (query) => query.queryHash !== hashKey(ME_QUERY_KEY) })
  queryClient.setQueryData(ME_QUERY_KEY, me)
}
