export type EntryDestination =
  | { kind: 'create' }
  | { kind: 'choose' }
  | { kind: 'company'; url: string }

type CompanyPage = { items: { url: string }[]; total: number }

export function entryDestination({ items, total }: CompanyPage): EntryDestination {
  if (total === 0) return { kind: 'create' }
  const [only] = items
  if (total === 1 && only) return { kind: 'company', url: only.url }
  return { kind: 'choose' }
}
