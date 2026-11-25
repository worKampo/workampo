import { useMutation, useQueryClient } from '@tanstack/react-query'
import { useApiClient } from '../../../_shared/api-client-context'
import { meQueryOptions } from '../../../access/me.hook'
import { createCompany } from '../../_api/companies.api'
import { myCompaniesQueryPrefix } from '../../_api/query-keys'

type CreateCompanyVariables = {
  input: Parameters<typeof createCompany>[1]
  idempotencyKey: string
}

export function useCreateCompany() {
  const client = useApiClient()
  const queryClient = useQueryClient()

  return useMutation({
    mutationFn: ({ input, idempotencyKey }: CreateCompanyVariables) =>
      createCompany(client, input, idempotencyKey),
    // A create may have named the account, and the new company must show in my list.
    onSuccess: () =>
      Promise.all([
        queryClient.invalidateQueries({ queryKey: meQueryOptions(client).queryKey }),
        queryClient.invalidateQueries({ queryKey: myCompaniesQueryPrefix }),
      ]),
  })
}
