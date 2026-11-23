import { useMutation, useQueryClient } from '@tanstack/react-query'
import { useApiClient } from '../../_shared/api-client-context'
import { ME_QUERY_KEY } from '../query-keys'
import { startCodeSignIn, verifyCode } from './sign-in-api'

export function useStartCodeSignIn() {
  const client = useApiClient()

  return useMutation({ mutationFn: (input: { email: string }) => startCodeSignIn(client, input) })
}

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
