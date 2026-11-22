import { queryOptions, useMutation, useQuery, useQueryClient } from '@tanstack/react-query'
import type { ApiClient } from '../../_shared/api-client'
import { useApiClient } from '../../_shared/api-client-context'
import { ME_QUERY_KEY } from '../query-keys'
import { getMe, signOut } from './session-api'

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
    // A me request still in flight would otherwise overwrite what this writes.
    onSuccess: async () => {
      await queryClient.cancelQueries({ queryKey: ME_QUERY_KEY })
      queryClient.setQueryData(ME_QUERY_KEY, null)
    },
  })
}
