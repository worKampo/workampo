import { renderHook, waitFor } from '@testing-library/react'
import { replaceSession } from '@workampo/app-core/access/me'
import { describe, expect, it } from 'vitest'
import { hookWrapper, problem, type Sent } from '../../../_shared/testing/hook-wrapper'
import { useCompanyPicker } from './company-picker.hook'

type Item = { name: string; slug: string; url: string }

const item = (name: string, slug: string): Item => ({
  name,
  slug,
  url: `https://app.test/c/${slug}/`,
})

// The API orders by the raw name; the picker orders the page as people read it.
const RAW_ORDER = [
  item('Northwind', 'northwind'),
  item('Sol Bakery', 'sol-bakery'),
  item('Zeta', 'zeta'),
  item('Ábaco', 'abaco'),
  item('árbol', 'arbol'),
  item('Clínica Norte', 'clinica-norte'),
]

function myCompaniesApi(items: Item[] = RAW_ORDER, total = items.length) {
  return ({ url }: Sent) =>
    new URL(url).pathname === '/api/companies'
      ? Response.json({ items, total })
      : problem({ status: 404, code: 'companies.not_found' })
}

async function renderPicker(answer = myCompaniesApi(), language = 'es') {
  const { wrapper, sent, queryClient } = hookWrapper(answer)
  const { result } = renderHook(() => useCompanyPicker(language), { wrapper })

  return { result, sent, queryClient }
}

const names = (companies: Item[] | undefined) => companies?.map((company) => company.name)

describe('useCompanyPicker', () => {
  it('@id:companies-91-2 asks for my companies in one page of 100', async () => {
    const { result, sent } = await renderPicker()

    await waitFor(() => expect(result.current.companies).toBeDefined())
    const lists = sent.filter((s) => new URL(s.url).pathname === '/api/companies')
    expect(lists).toHaveLength(1)
    expect(lists[0]?.method).toBe('GET')
    expect(Object.fromEntries(new URL(lists[0]?.url ?? '').searchParams)).toEqual({
      page: '1',
      pageSize: '100',
    })
  })

  it('@id:companies-91-2 orders the companies with Intl for the language, accents and case included', async () => {
    const { result } = await renderPicker()

    await waitFor(() =>
      expect(names(result.current.companies)).toEqual([
        'Ábaco',
        'árbol',
        'Clínica Norte',
        'Northwind',
        'Sol Bakery',
        'Zeta',
      ]),
    )
  })

  it('@id:companies-91-2 orders by the given language', async () => {
    // Swedish sorts ä after z; Spanish sorts it with a.
    const items = [item('Zeta', 'zeta'), item('Äpple', 'apple'), item('Alfa', 'alfa')]
    const spanish = await renderPicker(myCompaniesApi(items), 'es')
    const swedish = await renderPicker(myCompaniesApi(items), 'sv')

    await waitFor(() =>
      expect(names(spanish.result.current.companies)).toEqual(['Alfa', 'Äpple', 'Zeta']),
    )
    await waitFor(() =>
      expect(names(swedish.result.current.companies)).toEqual(['Alfa', 'Zeta', 'Äpple']),
    )
  })

  it('@id:companies-91-2 keeps each company as the API gives it: name, slug and url', async () => {
    const { result } = await renderPicker()

    await waitFor(() => expect(result.current.companies).toHaveLength(RAW_ORDER.length))
    expect(result.current.companies).toEqual(expect.arrayContaining(RAW_ORDER))
    expect(result.current.total).toBe(RAW_ORDER.length)
  })

  it('@id:companies-91-3 with no company the list is empty, not missing', async () => {
    const { result } = await renderPicker(myCompaniesApi([]))

    await waitFor(() => expect(result.current.companies).toEqual([]))
    expect(result.current.total).toBe(0)
  })

  it('@id:companies-91-2 the list of one person never reaches the next one on the device', async () => {
    const { result, queryClient } = await renderPicker()
    await waitFor(() => expect(result.current.companies).toHaveLength(RAW_ORDER.length))
    const cached = () =>
      queryClient.getQueryCache().findAll({ queryKey: ['companies', 'mine'] }).length

    expect(cached()).toBe(1)
    await replaceSession(queryClient, { id: 'u2', email: 'bea@example.com' })

    expect(cached()).toBe(0)
  })
})
