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

type Item = { name: string; slug: string; url: string }

const company = (name: string, slug: string): Item => ({
  name,
  slug,
  url: `${window.location.origin}/c/${slug}/`,
})

// In the API's raw order, which is not how people read them.
const NORTHWIND = company('Northwind', 'northwind')
const MINE = [
  NORTHWIND,
  company('Sol Bakery', 'sol-bakery'),
  company('Ábaco', 'abaco'),
  company('Clínica Norte', 'clinica-norte'),
]
const ROLE = /propietari|administrador|miembro|lector|owner|admin|member|viewer/i

// Signed in as ana@example.com, a member of `companies`.
function pickerApi(companies: Item[] = MINE, { list }: { list?: () => Response } = {}) {
  return (request: Request) => {
    const { pathname } = new URL(request.url)
    if (pathname === '/api/me')
      return Response.json({ id: 'u1', email: 'ana@example.com', name: 'Ana' })
    if (pathname === '/api/companies' && request.method === 'GET')
      return list?.() ?? Response.json({ items: companies, total: companies.length })
    if (pathname === '/api/sessions/current') return new Response(null, { status: 204 })
    const slug = /^\/api\/t\/([^/]+)\/$/.exec(pathname)?.[1]
    const found = companies.find((c) => c.slug === slug)
    if (found) return Response.json({ name: found.name, slug: found.slug, role: 'owner' })

    return problem({ status: 404, code: 'companies.not_found' })
  }
}

// The links to companies, in page order, by the company each names.
async function companyLinks(names: string[]) {
  await screen.findByRole('link', { name: new RegExp(names[0] ?? '') })
  return screen
    .getAllByRole('link')
    .map((link) => names.find((name) => link.textContent?.includes(name)))
    .filter(Boolean)
}

describe('the company picker, /companies', () => {
  it('@id:companies-91-2 lists my companies in alphabetical order, with name and address, and no role', async () => {
    renderApp({ path: '/companies', answer: pickerApi() })

    expect(await companyLinks(MINE.map((c) => c.name))).toEqual([
      'Ábaco',
      'Clínica Norte',
      'Northwind',
      'Sol Bakery',
    ])
    for (const { slug } of MINE)
      expect(screen.getByText(`/c/${slug}`, { exact: false })).toBeTruthy()
    expect(screen.queryByText(ROLE)).toBeNull()
  })

  it('@id:companies-91-2 says who I am signed in as and lets me sign out', async () => {
    renderApp({ path: '/companies', answer: pickerApi() })

    await screen.findByRole('link', { name: /Northwind/ })
    expect(document.body.textContent).toContain('Has entrado como')
    expect(screen.getByText(/ana@example\.com/)).toBeTruthy()
    expect(screen.getByRole('button', { name: 'Cerrar sesión' })).toBeTruthy()
  })

  it('@id:companies-91-2 each company links to the url the API gives', async () => {
    renderApp({ path: '/companies', answer: pickerApi() })

    const link = await screen.findByRole('link', { name: /Sol Bakery/ })

    expect(link.getAttribute('href')).toMatch(/\/c\/sol-bakery\/?$/)
  })

  it('@id:companies-91-2 a company name with markup is shown as text', async () => {
    const name = '<img src=x onerror=alert(1)> Ñandú 日本'
    renderApp({ path: '/companies', answer: pickerApi([company(name, 'nandu'), NORTHWIND]) })

    expect(await screen.findByText(name)).toBeTruthy()
    expect(document.querySelector('img[src="x"]')).toBeNull()
    expect(document.querySelector('[onerror]')).toBeNull()
  })

  it('@id:companies-91-2 an email with markup is shown as text', async () => {
    renderApp({
      path: '/companies',
      answer: (request) =>
        new URL(request.url).pathname === '/api/me'
          ? Response.json({
              id: 'u1',
              email: '<img src=x onerror=alert(1)>@example.com',
              name: 'Ana',
            })
          : pickerApi()(request),
    })

    await screen.findByRole('link', { name: /Northwind/ })
    expect(document.body.textContent).toContain('<img src=x onerror=alert(1)>@example.com')
    expect(document.querySelector('img[src="x"]')).toBeNull()
  })

  it('@id:companies-91-4 choosing a company leads to it', async () => {
    const { router } = renderApp({ path: '/companies', answer: pickerApi() })

    await userEvent.click(await screen.findByRole('link', { name: /Sol Bakery/ }))

    expect(await screen.findByText('Bienvenido a Sol Bakery')).toBeTruthy()
    expect(router.state.location.pathname).toMatch(/^\/c\/sol-bakery\/?$/)
  })

  it('@id:companies-91-5 "Crear una empresa nueva" leads to the creation form', async () => {
    const { router } = renderApp({ path: '/companies', answer: pickerApi() })

    await userEvent.click(await screen.findByRole('link', { name: 'Crear una empresa nueva' }))

    expect(await screen.findByLabelText('Nombre de la empresa')).toBeTruthy()
    expect(router.state.location.pathname).toBe('/companies/new')
  })

  it('@id:companies-91-3 with no company the picker stays, empty, with the way to create one', async () => {
    const { router } = renderApp({ path: '/companies', answer: pickerApi([]) })

    expect(await screen.findByRole('link', { name: 'Crear una empresa nueva' })).toBeTruthy()
    expect(router.state.location.pathname).toBe('/companies')
  })

  it('@id:companies-91-2 without a session it leads to /login and back to the picker', async () => {
    const { router } = renderApp({
      path: '/companies',
      answer: () => problem({ status: 401, code: 'access.unauthenticated' }),
    })

    expect(await screen.findByRole('button', { name: 'Continuar' })).toBeTruthy()
    expect(router.state.location.pathname).toBe('/login')
    expect(router.state.location.search).toEqual({ returnTo: '/companies' })
  })

  it('@id:companies-91-2 a session that expired while me was cached leads to /login', async () => {
    const { router } = renderApp({
      path: '/companies',
      answer: sessionEndsAfterFirstMe(
        pickerApi(MINE, { list: () => problem({ status: 401, code: 'access.unauthenticated' }) }),
      ),
    })

    expect(await screen.findByRole('button', { name: 'Continuar' })).toBeTruthy()
    await waitFor(() => expect(router.state.location.pathname).toBe('/login'))
  })

  it('@id:companies-91-2 a session that expires with the list on screen leads to /login', async () => {
    let expired = false
    const api = pickerApi()
    const { router, queryClient } = renderApp({
      path: '/companies',
      answer: (request) =>
        expired ? problem({ status: 401, code: 'access.unauthenticated' }) : api(request),
    })
    await screen.findByRole('link', { name: /Northwind/ })

    expired = true
    await queryClient.refetchQueries({ type: 'active' })

    expect(await screen.findByRole('button', { name: 'Continuar' })).toBeTruthy()
    expect(router.state.location.pathname).toBe('/login')
    expect(router.state.location.search).toEqual({ returnTo: '/companies' })
  })
})
