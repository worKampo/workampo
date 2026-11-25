import { queryOptions, useQuery } from '@tanstack/react-query'
import type { ApiClient } from '../../../_shared/api-client'
import { useApiClient } from '../../../_shared/api-client-context'
import { listMyCompanies } from '../../_api/companies.api'
import { myCompaniesQueryKey } from '../../_api/query-keys'

// shortcut: one page of 100 companies, page the picker if someone has more
const PAGE = { page: 1, pageSize: 100 }

// Also for the router's guard and the next tickets, which run outside React.
export function myCompaniesQueryOptions(client: ApiClient) {
  return queryOptions({
    queryKey: myCompaniesQueryKey(PAGE.page, PAGE.pageSize),
    queryFn: () => listMyCompanies(client, PAGE),
  })
}

export function useMyCompanies() {
  return useQuery(myCompaniesQueryOptions(useApiClient()))
}
