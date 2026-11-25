import { useMutation } from '@tanstack/react-query'
import { useApiClient } from '../../../_shared/api-client-context'
import { startCodeSignIn } from '../../_api/sign-in.api'

export function useStartCodeSignIn() {
  const client = useApiClient()

  return useMutation({ mutationFn: (input: { email: string }) => startCodeSignIn(client, input) })
}
