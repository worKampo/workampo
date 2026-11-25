import { useMutation, useQueryClient } from '@tanstack/react-query'
import { useApiClient } from '../../../_shared/api-client-context'
import { verifyCode } from '../../_api/sign-in.api'
import { replaceSession } from '../../me.hook'

export function useVerifyCode() {
  const client = useApiClient()
  const queryClient = useQueryClient()

  return useMutation({
    mutationFn: (input: { email: string; code: string }) => verifyCode(client, input),
    onSuccess: (user) => replaceSession(queryClient, user),
  })
}
