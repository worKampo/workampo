import { useMutation, useQueryClient } from '@tanstack/react-query'
import { useApiClient } from '../../../_shared/api-client-context'
import { ME_QUERY_KEY } from '../../data/query-keys'
import { verifyCode } from '../../data/sign-in.api'

export function useVerifyCode() {
  const client = useApiClient()
  const queryClient = useQueryClient()

  return useMutation({
    mutationFn: (input: { email: string; code: string }) => verifyCode(client, input),
    // A me request still in flight would otherwise overwrite what this writes.
    onSuccess: async (user) => {
      await queryClient.cancelQueries({ queryKey: ME_QUERY_KEY })
      queryClient.setQueryData(ME_QUERY_KEY, user)
    },
  })
}
