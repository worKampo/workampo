// Every TanStack Query key of the companies domain: hooks import them from here, never from each other.
export const companyContextQueryKey = (slug: string) => ['companies', 'context', slug] as const
