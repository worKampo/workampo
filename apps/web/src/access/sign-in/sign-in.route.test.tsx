import { cleanup, configure, screen, waitFor } from '@testing-library/react'
import userEvent from '@testing-library/user-event'
import { afterEach, beforeAll, describe, expect, it } from 'vitest'
import { initI18n } from '../../_shared/i18n/i18n'
import { problem, renderApp } from '../../_shared/testing/render-app'

// The first visit downloads the lazy screen and its translations; under a busy check that is slow.
configure({ asyncUtilTimeout: 5000 })

beforeAll(async () => {
  await initI18n(['es-ES'])
})

afterEach(cleanup)

describe('signing in with a code', () => {
  it('@id:access-96-1 the email leads to the code screen, which names it', async () => {
    renderApp({ path: '/login', answer: signInApi })

    await userEvent.type(await screen.findByRole('textbox'), 'ana@example.com')
    await userEvent.click(screen.getByRole('button', { name: 'Continuar' }))

    expect(await screen.findByText('ana@example.com')).toBeTruthy()
    expect(screen.getByRole('button', { name: 'Reenviar código' })).toBeTruthy()
  })

  it('@id:access-96-3 a wrong code says so and keeps the way to ask for another', async () => {
    renderApp({ path: '/login', answer: signInApi })
    await userEvent.type(await screen.findByRole('textbox'), 'ana@example.com')
    await userEvent.click(screen.getByRole('button', { name: 'Continuar' }))

    await userEvent.type(await screen.findByRole('textbox'), '111111{Enter}')

    expect(await screen.findByText(/no es válido/)).toBeTruthy()
    expect(screen.getByRole('button', { name: 'Reenviar código' })).toBeTruthy()
  })

  it.fails('@id:access-96-2 the right code of a new account signs in and lands on the creation form', async () => {
    const { router } = renderApp({ path: '/login', answer: accountApi() })

    await signInWithCode()

    expect(await screen.findByLabelText('Nombre de la empresa')).toBeTruthy()
    expect(router.state.location.pathname).toBe('/companies/new')
    expect(screen.queryByText('Aún no perteneces a ninguna empresa')).toBeNull()
  })

  it.fails('@id:companies-91-1 with one company the code leads to it', async () => {
    const { router } = renderApp({ path: '/login', answer: accountApi([NORTHWIND]) })

    await signInWithCode()

    expect(await screen.findByText('Bienvenido a Northwind')).toBeTruthy()
    expect(router.state.location.pathname).toMatch(/^\/c\/northwind\/?$/)
  })

  it.fails('@id:companies-91-2 with several companies the code leads to the picker', async () => {
    const { router } = renderApp({ path: '/login', answer: accountApi([NORTHWIND, SOL_BAKERY]) })

    await signInWithCode()

    expect(await screen.findByRole('link', { name: /Sol Bakery/ })).toBeTruthy()
    expect(router.state.location.pathname).toBe('/companies')
  })

  it.fails('@id:access-91-1 the code comes back to the page I opened', async () => {
    for (const returnTo of ['/c/northwind/settings', '/c/northwind/members?page=2']) {
      const { router } = renderApp({
        path: `/login?returnTo=${encodeURIComponent(returnTo)}`,
        answer: accountApi([NORTHWIND, SOL_BAKERY]),
      })

      await signInWithCode()

      await waitFor(() => expect(pathOf(router), returnTo).toBe(returnTo))
      cleanup()
    }
  })

  it.fails('@id:access-91-1 "Usar otro email" keeps the way back', async () => {
    const { router } = renderApp({
      path: `/login?returnTo=${encodeURIComponent('/c/northwind/settings')}`,
      answer: accountApi(),
    })
    await userEvent.type(await screen.findByRole('textbox'), 'ana@example.com')
    await userEvent.click(screen.getByRole('button', { name: 'Continuar' }))

    await userEvent.click(await screen.findByRole('link', { name: 'Usar otro email' }))

    await waitFor(() => expect(router.state.location.pathname).toBe('/login'))
    expect(router.state.location.search).toEqual({ returnTo: '/c/northwind/settings' })
  })

  it.fails('@id:access-91-2 the Google link carries the way back', async () => {
    renderApp({
      path: `/login?returnTo=${encodeURIComponent('/c/northwind/settings')}`,
      answer: accountApi(),
    })

    const google = await screen.findByRole('link', { name: 'Continuar con Google' })

    expect(google.getAttribute('href')).toBe(
      `/api/sessions/google?returnTo=${encodeURIComponent('/c/northwind/settings')}`,
    )
  })

  it('@id:access-91-2 without a way back the Google link is the plain start', async () => {
    renderApp({ path: '/login', answer: accountApi() })

    const google = await screen.findByRole('link', { name: 'Continuar con Google' })

    expect(google.getAttribute('href')).toBe('/api/sessions/google')
  })

  for (const returnTo of [
    'https://otro-sitio.example.com',
    '//otro-sitio.example.com',
    '/\\otro-sitio.example.com',
    'javascript:alert(1)',
    '/login',
    '/api/me',
  ])
    it.fails(`@id:access-91-3 the way back ${JSON.stringify(returnTo)} is ignored: the code leads where signing in leads`, async () => {
      const { router } = renderApp({
        path: `/login?returnTo=${encodeURIComponent(returnTo)}`,
        answer: accountApi(),
      })
      const google = await screen.findByRole('link', { name: 'Continuar con Google' })
      expect(google.getAttribute('href')).toBe('/api/sessions/google')

      await signInWithCode()

      expect(await screen.findByLabelText('Nombre de la empresa')).toBeTruthy()
      expect(router.state.location.pathname).toBe('/companies/new')
    })

  it('@id:access-96-15 without a session / goes to /login', async () => {
    const { router } = renderApp({ path: '/', answer: signInApi })

    expect(await screen.findByRole('button', { name: 'Continuar' })).toBeTruthy()
    expect(router.state.location.pathname).toBe('/login')
  })

  it('@id:access-96-16 asks for no password', async () => {
    renderApp({ path: '/login', answer: signInApi })

    await screen.findByRole('button', { name: 'Continuar' })

    expect(document.querySelector('input[type="password"]')).toBeNull()
    expect(screen.queryByText(/contraseña/i)).toBeNull()
  })
})

// The API as the fake identity provider answers it locally; only the routes these tests use.
async function signInApi(request: Request) {
  const { pathname } = new URL(request.url)
  if (pathname === '/api/sign-in-codes') return new Response(null, { status: 202 })
  if (pathname === '/api/me') return problem({ status: 401, code: 'access.unauthenticated' })

  const { code } = await request.json<{ code: string }>()
  if (code === '424242')
    return Response.json({ user: { id: 'u1', email: 'ana@example.com' } }, { status: 201 })

  return problem({ status: 400, code: 'access.invalid_code' })
}

type Item = { name: string; slug: string; url: string }
const company = (name: string, slug: string): Item => ({
  name,
  slug,
  url: `${window.location.origin}/c/${slug}/`,
})
const NORTHWIND = company('Northwind', 'northwind')
const SOL_BAKERY = company('Sol Bakery', 'sol-bakery')

// Like signInApi, but the session exists once the right code is sent, and it holds `companies`.
function accountApi(companies: Item[] = []) {
  let signedIn = false
  return async (request: Request) => {
    const { pathname } = new URL(request.url)
    if (pathname === '/api/me')
      return signedIn
        ? Response.json({ id: 'u1', email: 'ana@example.com', name: 'Ana' })
        : problem({ status: 401, code: 'access.unauthenticated' })
    if (pathname === '/api/sessions' && request.method === 'POST') {
      const answer = await signInApi(request)
      signedIn = answer.status === 201
      return answer
    }
    if (pathname === '/api/companies' && request.method === 'GET')
      return Response.json({ items: companies, total: companies.length })
    const slug = /^\/api\/t\/([^/]+)\/$/.exec(pathname)?.[1]
    const found = companies.find((c) => c.slug === slug)
    if (found) return Response.json({ name: found.name, slug: found.slug, role: 'owner' })
    if (pathname.startsWith('/api/t/')) return problem({ status: 404, code: 'companies.not_found' })

    return signInApi(request)
  }
}

async function signInWithCode() {
  await userEvent.type(await screen.findByRole('textbox'), 'ana@example.com')
  await userEvent.click(screen.getByRole('button', { name: 'Continuar' }))
  await userEvent.type(await screen.findByRole('textbox'), '424242{Enter}')
}

const pathOf = (router: ReturnType<typeof renderApp>['router']) =>
  `${router.state.location.pathname}${router.state.location.searchStr}`
