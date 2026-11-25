import { queryOptions, useQuery } from '@tanstack/react-query'
import type { ApiClient } from '../../../_shared/api-client'
import { useApiClient } from '../../../_shared/api-client-context'
import { getCompanyContext } from '../../data/companies.api'
import { companyContextQueryKey } from '../../data/query-keys'

// Also for the router's guard and the next tickets, which run outside React.
export function companyContextQueryOptions(client: ApiClient, slug: string) {
  return queryOptions({
    queryKey: companyContextQueryKey(slug),
    queryFn: () => getCompanyContext(client, slug),
  })
}

export function useCompanyContext(slug: string) {
  return useQuery(companyContextQueryOptions(useApiClient(), slug))
}
