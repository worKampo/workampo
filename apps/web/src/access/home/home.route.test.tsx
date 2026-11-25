import { cleanup, configure, screen, waitFor } from '@testing-library/react'
import { afterEach, beforeAll, describe, expect, it } from 'vitest'
import { initI18n } from '../../_shared/i18n/i18n'
import { problem, renderApp } from '../../_shared/testing/render-app'

// The first visit downloads the lazy screen and its translations; under a busy check that is slow.
configure({ asyncUtilTimeout: 5000 })

beforeAll(async () => {
  await initI18n(['es-ES'])
})

afterEach(cleanup)

type Item = { name: string; slug: string; url: string }

const company = (name: string, slug: string): Item => ({
  name,
  slug,
  url: `${window.location.origin}/c/${slug}/`,
})

// Signed in as Ana, a member of `companies`; asked paths are recorded.
function homeApi(companies: Item[], asked: string[] = []) {
  return (request: Request) => {
    const { pathname, search } = new URL(request.url)
    asked.push(`${request.method} ${pathname}${search}`)
    if (pathname === '/api/me')
      return Response.json({ id: 'u1', email: 'ana@example.com', name: 'Ana' })
    if (pathname === '/api/companies' && request.method === 'GET')
      return Response.json({ items: companies, total: companies.length })
    const slug = /^\/api\/t\/([^/]+)\/$/.exec(pathname)?.[1]
    const found = companies.find((c) => c.slug === slug)
    if (found) return Response.json({ name: found.name, slug: found.slug, role: 'owner' })

    return problem({ status: 404, code: 'companies.not_found' })
  }
}

describe('the start, /', () => {
  it.fails('@id:companies-91-7 with one company it leads to that company', async () => {
    const { router } = renderApp({
      path: '/',
      answer: homeApi([company('Northwind', 'northwind')]),
    })

    expect(await screen.findByText('Bienvenido a Northwind')).toBeTruthy()
    expect(router.state.location.pathname).toMatch(/^\/c\/northwind\/?$/)
  })

  it.fails('@id:companies-91-7 with several companies it leads to the picker', async () => {
    const { router } = renderApp({
      path: '/',
      answer: homeApi([company('Northwind', 'northwind'), company('Sol Bakery', 'sol-bakery')]),
    })

    expect(await screen.findByRole('link', { name: /Sol Bakery/ })).toBeTruthy()
    expect(router.state.location.pathname).toBe('/companies')
  })

  it.fails('@id:companies-91-7 with no company it leads straight to the creation form', async () => {
    const { router } = renderApp({ path: '/', answer: homeApi([]) })

    expect(await screen.findByLabelText('Nombre de la empresa')).toBeTruthy()
    expect(router.state.location.pathname).toBe('/companies/new')
    expect(screen.queryByText('Aún no perteneces a ninguna empresa')).toBeNull()
  })

  it.fails('@id:companies-91-7 asks the API for one page of 100 of my companies', async () => {
    const asked: string[] = []
    renderApp({ path: '/', answer: homeApi([], asked) })

    await screen.findByLabelText('Nombre de la empresa')
    const list = asked.find((line) => line.startsWith('GET /api/companies?')) ?? ''
    const query = new URLSearchParams(list.slice(list.indexOf('?')))
    expect(Object.fromEntries(query)).toEqual({ page: '1', pageSize: '100' })
  })

  it('@id:companies-91-8 without a session it leads to /login, with no way back', async () => {
    const { router } = renderApp({
      path: '/',
      answer: () => problem({ status: 401, code: 'access.unauthenticated' }),
    })

    expect(await screen.findByRole('button', { name: 'Continuar' })).toBeTruthy()
    await waitFor(() => expect(router.state.location.pathname).toBe('/login'))
    expect(router.state.location.search).toEqual({})
  })
})
