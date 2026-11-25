import { renderHook, waitFor } from '@testing-library/react'
import { describe, expect, it } from 'vitest'
import { problem } from '../../../_shared/testing/fake-api'
import { hookWrapper } from '../../../_shared/testing/hook-wrapper'
import { useCompanyContext } from './read-context.hook'

describe('useCompanyContext', () => {
  it('@id:companies-90-1 reads the name, slug and my role in the company', async () => {
    const context = { name: 'Northwind Logistics', slug: 'northwind', role: 'owner' }
    const { wrapper, sent } = hookWrapper(() => Response.json(context))

    const { result } = renderHook(() => useCompanyContext('northwind'), { wrapper })

    await waitFor(() => expect(result.current.data).toEqual(context))
    expect(sent[0]?.url).toBe('https://app.test/api/t/northwind/')
  })

  it('@id:companies-90-12 a company I cannot enter ends in an error with status 404', async () => {
    const { wrapper } = hookWrapper(() => problem({ status: 404, code: 'companies.not_found' }))

    const { result } = renderHook(() => useCompanyContext('sol-bakery'), { wrapper })

    await waitFor(() => expect(result.current.isError).toBe(true))
    expect(result.current.error).toMatchObject({ status: 404 })
  })

  it('@id:companies-90-12 each slug is its own query', async () => {
    const { wrapper } = hookWrapper(({ url }) =>
      Response.json({
        name: url.includes('northwind') ? 'Northwind' : 'Sol',
        slug: 'x',
        role: 'owner',
      }),
    )

    const northwind = renderHook(() => useCompanyContext('northwind'), { wrapper })
    const sol = renderHook(() => useCompanyContext('sol-bakery'), { wrapper })

    await waitFor(() => expect(northwind.result.current.data?.name).toBe('Northwind'))
    await waitFor(() => expect(sol.result.current.data?.name).toBe('Sol'))
  })
})
