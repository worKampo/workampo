import { queryOptions, useMutation, useQuery, useQueryClient } from '@tanstack/react-query'
import type { ApiClient } from '../../api-client'
import { useApiClient } from '../../api-client-context'
import { getMe, signOut } from './api'

export const ME_QUERY_KEY = ['access', 'me'] as const

// Also for the router's guard, which runs outside React.
export function meQueryOptions(client: ApiClient) {
  return queryOptions({ queryKey: ME_QUERY_KEY, queryFn: () => getMe(client) })
}

export function useMe() {
  return useQuery(meQueryOptions(useApiClient()))
}

export function useSignOut() {
  const client = useApiClient()
  const queryClient = useQueryClient()

  return useMutation({
    mutationFn: () => signOut(client),
    onSuccess: () => queryClient.setQueryData(ME_QUERY_KEY, null),
  })
}
