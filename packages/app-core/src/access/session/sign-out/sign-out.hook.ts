import { useMutation, useQueryClient } from '@tanstack/react-query'
import { useApiClient } from '../../../_shared/api-client-context'
import { ME_QUERY_KEY } from '../../data/query-keys'
import { signOut } from '../../data/session.api'

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
