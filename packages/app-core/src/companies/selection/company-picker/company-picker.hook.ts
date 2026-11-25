import { useMemo } from 'react'
import { useMyCompanies } from '../list-my-companies/list-my-companies.hook'

// The API orders by the raw name; the picker orders the page as people of `language` read it.
export function useCompanyPicker(language: string) {
  const { data } = useMyCompanies()
  const companies = useMemo(() => {
    const collator = new Intl.Collator(language)

    return data?.items.toSorted((a, b) => collator.compare(a.name, b.name))
  }, [data, language])

  return { companies, total: data?.total }
}
