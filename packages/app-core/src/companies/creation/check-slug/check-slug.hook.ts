import { useQuery } from '@tanstack/react-query'
import { useApiClient } from '../../../_shared/api-client-context'
import { checkSlug } from '../../data/companies.api'
import { slugAvailabilityQueryKey } from '../../data/query-keys'

export function useCheckSlug({ slug, enabled }: { slug: string; enabled: boolean }) {
  const client = useApiClient()

  return useQuery({
    queryKey: slugAvailabilityQueryKey(slug),
    queryFn: () => checkSlug(client, slug),
    enabled,
  })
}
