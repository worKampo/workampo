import { useMutation, useQueryClient } from '@tanstack/react-query'
import { useApiClient } from '../../api-client-context'
import { ME_QUERY_KEY } from '../session/hooks'
import { startCodeSignIn, verifyCode } from './api'

export function useStartCodeSignIn() {
  const client = useApiClient()

  return useMutation({ mutationFn: (input: { email: string }) => startCodeSignIn(client, input) })
}

export function useVerifyCode() {
  const client = useApiClient()
  const queryClient = useQueryClient()

  return useMutation({
    mutationFn: (input: { email: string; code: string }) => verifyCode(client, input),
    onSuccess: (user) => queryClient.setQueryData(ME_QUERY_KEY, user),
  })
}
