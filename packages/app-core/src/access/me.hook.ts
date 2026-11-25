import { queryOptions, useQuery } from '@tanstack/react-query'
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
