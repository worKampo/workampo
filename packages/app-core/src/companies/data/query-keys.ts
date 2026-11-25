// Every TanStack Query key of the companies domain: hooks import them from here, never from each other.
export const companyContextQueryKey = (slug: string) => ['companies', 'context', slug] as const
export const slugAvailabilityQueryKey = (slug: string) =>
  ['companies', 'slug-availability', slug] as const
export const myCompaniesQueryPrefix = ['companies', 'mine'] as const
export const myCompaniesQueryKey = (page: number, pageSize: number) =>
  [...myCompaniesQueryPrefix, page, pageSize] as const
