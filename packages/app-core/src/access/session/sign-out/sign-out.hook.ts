import { useMutation, useQueryClient } from '@tanstack/react-query'
import { useApiClient } from '../../../_shared/api-client-context'
import { signOut } from '../../data/session.api'
import { replaceSession } from '../../me.hook'

export function useSignOut() {
  const client = useApiClient()
  const queryClient = useQueryClient()

  return useMutation({
    mutationFn: () => signOut(client),
    onSuccess: () => replaceSession(queryClient, null),
  })
}
