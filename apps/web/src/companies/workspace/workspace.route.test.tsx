import { cleanup, configure, screen, waitFor } from '@testing-library/react'
import userEvent from '@testing-library/user-event'
import { afterEach, beforeAll, describe, expect, it } from 'vitest'
import { initI18n } from '../../_shared/i18n/i18n'
import { problem, renderApp, sessionEndsAfterFirstMe } from '../../_shared/testing/render-app'

// The first visit downloads the lazy screen and its translations; under a busy check that is slow.
configure({ asyncUtilTimeout: 5000 })

beforeAll(async () => {
  await initI18n(['es-ES'])
})

afterEach(cleanup)

// Signed in as a member of `companies` only; any other slug answers like the API's identical 404.
function workspaceApi(companies: Record<string, string>, asked: string[] = []) {
  return (request: Request) => {
    const { pathname } = new URL(request.url)
    asked.push(pathname)
    if (pathname === '/api/me')
      return Response.json({ id: 'u1', email: 'ana@example.com', name: 'Ana' })
    const slug = /^\/api\/t\/([^/]+)\/$/.exec(pathname)?.[1]
    const name = slug && companies[slug]
    if (slug && name) return Response.json({ name, slug, role: 'owner' })

    return problem({ status: 404, code: 'companies.not_found' })
  }
}

describe('the company home', () => {
  it('@id:companies-90-1 welcomes me with the company name', async () => {
    renderApp({ path: '/c/northwind', answer: workspaceApi({ northwind: 'Northwind Logistics' }) })

    expect(await screen.findByText('Bienvenido a Northwind Logistics')).toBeTruthy()
  })

  it('@id:companies-90-1 shows a long name with unicode and markup as text', async () => {
    const name = 'Cooperativa Agrícola Ñandú <img src=x onerror=alert(1)> 日本 — Sociedad Limitada'
    renderApp({ path: '/c/northwind', answer: workspaceApi({ northwind: name }) })

    expect(await screen.findByText(`Bienvenido a ${name}`)).toBeTruthy()
    expect(document.querySelector('img[src="x"]')).toBeNull()
  })

  it('@id:companies-90-12 another company looks the same as one that does not exist', async () => {
    const asked: string[] = []
    const api = workspaceApi({ northwind: 'Northwind Logistics' }, asked)
    renderApp({ path: '/c/sol-bakery', answer: api })
    const foreign = await screen.findByRole('heading')
    const foreignText = document.body.textContent?.replaceAll('sol-bakery', '<slug>')
    cleanup()

    renderApp({ path: '/c/missing-company', answer: api })
    await screen.findByRole('heading')
    const missingText = document.body.textContent?.replaceAll('missing-company', '<slug>')

    expect(foreign).toBeTruthy()
    // The not-found state is the company page's answer to the API, not a route that does not exist.
    expect(asked).toEqual(expect.arrayContaining(['/api/t/sol-bakery/', '/api/t/missing-company/']))
    expect(foreignText).not.toContain('Bienvenido')
    expect(foreignText).toBe(missingText)
  })

  it('@id:companies-90-12 the not-found state leads back to the start', async () => {
    const { router } = renderApp({ path: '/c/sol-bakery', answer: workspaceApi({}) })

    await userEvent.click(await screen.findByRole('link', { name: 'Volver a mis empresas' }))

    await waitFor(() => expect(router.state.location.pathname).toBe('/'))
  })

  it('@id:companies-90-13 without a session a company page leads to /login', async () => {
    const { router } = renderApp({
      path: '/c/northwind',
      answer: () => problem({ status: 401, code: 'access.unauthenticated' }),
    })

    expect(await screen.findByRole('button', { name: 'Continuar' })).toBeTruthy()
    expect(router.state.location.pathname).toBe('/login')
  })

  it('@id:companies-90-13 without a session a company page leads to /login carrying the way back', async () => {
    const { router } = renderApp({
      path: '/c/northwind',
      answer: () => problem({ status: 401, code: 'access.unauthenticated' }),
    })

    expect(await screen.findByRole('button', { name: 'Continuar' })).toBeTruthy()
    expect(router.state.location.pathname).toBe('/login')
    expect(router.state.location.search).toEqual({ returnTo: '/c/northwind' })
  })

  it('@id:access-91-1 without a session a company subpage leads to /login carrying it, query included', async () => {
    for (const path of ['/c/northwind/settings', '/c/northwind/members?page=2']) {
      const { router } = renderApp({
        path,
        answer: () => problem({ status: 401, code: 'access.unauthenticated' }),
      })

      expect(await screen.findByRole('button', { name: 'Continuar' })).toBeTruthy()
      expect(router.state.location.pathname, path).toBe('/login')
      expect(router.state.location.search, path).toEqual({ returnTo: path })
      cleanup()
    }
  })

  it('@id:access-91-1 a company subpage that does not exist yet shows a page not-found state that leads back to the company', async () => {
    const asked: string[] = []
    const { router } = renderApp({
      path: '/c/northwind/settings',
      answer: workspaceApi({ northwind: 'Northwind Logistics' }, asked),
    })

    expect(await screen.findByRole('heading', { name: 'No encontramos esta página' })).toBeTruthy()
    expect(
      screen.getByText('La dirección puede estar mal escrita o la página se ha movido.'),
    ).toBeTruthy()
    expect(screen.queryByText('No encontramos esta empresa')).toBeNull()
    expect(router.state.location.pathname).toBe('/c/northwind/settings')
    expect(asked).toContain('/api/me')

    await userEvent.click(screen.getByRole('link', { name: 'Volver a Northwind Logistics' }))

    expect(await screen.findByText('Bienvenido a Northwind Logistics')).toBeTruthy()
    expect(router.state.location.pathname).toMatch(/^\/c\/northwind\/?$/)
  })

  it('@id:companies-90-13 a session that expired while me was cached leads to /login carrying the way back', async () => {
    const companies = workspaceApi({ northwind: 'Northwind Logistics' })
    const { router } = renderApp({
      path: '/c/northwind',
      answer: sessionEndsAfterFirstMe((request) =>
        new URL(request.url).pathname === '/api/t/northwind/'
          ? problem({ status: 401, code: 'access.unauthenticated' })
          : companies(request),
      ),
    })

    expect(await screen.findByRole('button', { name: 'Continuar' })).toBeTruthy()
    await waitFor(() => expect(router.state.location.pathname).toBe('/login'))
    expect(router.state.location.search).toEqual({ returnTo: '/c/northwind' })
  })

  it('@id:companies-90-13 a session that expired while me was cached leads to /login', async () => {
    const companies = workspaceApi({ northwind: 'Northwind Logistics' })
    const { router } = renderApp({
      path: '/c/northwind',
      answer: sessionEndsAfterFirstMe((request) =>
        new URL(request.url).pathname === '/api/t/northwind/'
          ? problem({ status: 401, code: 'access.unauthenticated' })
          : companies(request),
      ),
    })

    expect(await screen.findByRole('button', { name: 'Continuar' })).toBeTruthy()
    expect(router.state.location.pathname).toBe('/login')
  })
})
