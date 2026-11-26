import { cleanup, configure, screen, waitFor, within } from '@testing-library/react'
import userEvent from '@testing-library/user-event'
import { afterEach, beforeAll, describe, expect, it, vi } from 'vitest'
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

  it.fails('@id:companies-90-12 the not-found state is the system 404, which leads home', async () => {
    const { router } = renderApp({ path: '/c/sol-bakery', answer: workspaceApi({}) })

    expect(
      await screen.findByRole('heading', { level: 1, name: 'Página no encontrada' }),
    ).toBeTruthy()
    const home = screen.getByRole('link', { name: 'Ir al inicio' })
    expect(home.getAttribute('href')).toBe('/')
    await waitFor(() => expect(document.title).toBe('Página no encontrada · worKampo'))
    await userEvent.click(home)

    await waitFor(() => expect(router.state.location.pathname).not.toMatch(/^\/c\/sol-bakery/))
  })

  it.fails('@id:companies-90-12 A1 a foreign and a missing company render the same HTML, with no slug', async () => {
    const api = workspaceApi({ northwind: 'Northwind Logistics' })
    // React's generated ids count up across renders; nothing else may differ.
    const html = () => document.body.innerHTML.replace(/«r[0-9a-z]+»|:r[0-9a-z]+:/g, '<id>')
    renderApp({ path: '/c/sol-bakery', answer: api })
    await screen.findByRole('heading', { level: 1, name: 'Página no encontrada' })
    const foreign = html()
    cleanup()

    renderApp({ path: '/c/missing-company', answer: api })
    await screen.findByRole('heading', { level: 1, name: 'Página no encontrada' })
    const missing = html()

    expect(foreign).not.toContain('sol-bakery')
    expect(missing).not.toContain('missing-company')
    expect(foreign).toBe(missing)
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

// The shell's API: me (with or without a name), the context of `northwind`, and a sign-out that
// answers with `signOut`. `context` overrides the context's answer.
function shellApi({
  name = 'Ana',
  signOut = () => new Response(null, { status: 204 }),
  context,
  asked = [],
}: Partial<{
  name: string | null
  signOut: () => Response | Promise<Response>
  context: () => Response | Promise<Response>
  asked: string[]
}> = {}) {
  const companies = workspaceApi({ northwind: 'Northwind Logistics' })
  return (request: Request) => {
    const { pathname } = new URL(request.url)
    asked.push(`${request.method} ${pathname}`)
    if (request.method === 'DELETE') return signOut()
    if (pathname === '/api/me')
      return Response.json({ id: 'u1', email: 'ana@example.com', ...(name ? { name } : {}) })
    if (pathname === '/api/t/northwind/' && context) return context()

    return companies(request)
  }
}

const HOME = 'Bienvenido a Northwind Logistics'
const SIDEBAR_KEY = 'workampo:sidebar'
const NORTHWIND = { name: 'Northwind Logistics', slug: 'northwind', role: 'owner' }

async function openHome(answer = shellApi()) {
  const rendered = renderApp({ path: '/c/northwind', answer })
  await screen.findByText(HOME)
  return rendered
}

// The account button; below 1024 px the topbar repeats it, so the sidebar's is the first.
async function openAccountMenu(name: RegExp) {
  const [account] = await screen.findAllByRole('button', { name })
  if (!account) throw new Error(`no account button named ${name}`)
  account.focus()
  await userEvent.keyboard('{Enter}')
  return { account, menu: await screen.findByRole('menu') }
}

describe('the company shell', () => {
  afterEach(() => {
    vi.restoreAllMocks()
    localStorage.clear()
  })

  it('@id:companies-92-1 shows the company, my role and «Inicio» as the current page', async () => {
    await openHome()

    const companyLinks = screen.getAllByRole('link', { name: /Northwind Logistics/ })
    expect(companyLinks.some((link) => link.textContent?.includes('Propietario'))).toBe(true)
    const current = screen
      .getAllByRole('link')
      .filter((link) => link.getAttribute('aria-current') === 'page')
    expect(current.length).toBeGreaterThan(0)
    for (const link of current) expect(link.textContent).toContain('Inicio')
  })

  it('@id:companies-92-2 renders nothing that does not exist yet', async () => {
    await openHome()

    expect(screen.getAllByRole('navigation').length).toBeGreaterThan(0)
    expect(screen.queryByRole('searchbox')).toBeNull()
    for (const text of [/notificaciones/i, /página pública/i, /ajustes/i, /ayuda/i, /mi cuenta/i])
      expect(screen.queryAllByText(text)).toHaveLength(0)
    expect(screen.queryAllByText(/\bplan\b|prueba/i)).toHaveLength(0)
  })

  it('@id:companies-92-3 «Tus direcciones» shows the app address only', async () => {
    await openHome()

    expect(screen.getByRole('heading', { name: 'Tus direcciones' })).toBeTruthy()
    expect(screen.getByText('App')).toBeTruthy()
    expect(screen.getByText(`${window.location.host}/c/northwind`)).toBeTruthy()
    const main = screen.getByRole('main').textContent ?? ''
    expect(main.split(window.location.host)).toHaveLength(2)
  })

  it('@id:companies-92-4 the company button links to the company picker', async () => {
    await openHome()

    const companyLinks = screen.getAllByRole('link', { name: /Northwind Logistics/ })

    expect(companyLinks.some((link) => link.getAttribute('href') === '/companies')).toBe(true)
  })

  it('@id:companies-92-5 the user menu shows my name and email, not as items, and signs me out to /login', async () => {
    const asked: string[] = []
    const { router } = await openHome(shellApi({ asked }))

    const { menu } = await openAccountMenu(/Ana/)
    expect(within(menu).getByText('Ana')).toBeTruthy()
    expect(within(menu).getByText('ana@example.com')).toBeTruthy()
    expect(
      within(menu)
        .getAllByRole('menuitem')
        .map((item) => item.textContent),
    ).toEqual(['Cerrar sesión'])
    await userEvent.click(within(menu).getByRole('menuitem', { name: 'Cerrar sesión' }))

    await waitFor(() => expect(router.state.location.pathname).toBe('/login'))
    expect(asked.some((call) => call.startsWith('DELETE '))).toBe(true)
  })

  it('@id:companies-92-5 while signing out the menu stays open, the item disabled and the button busy', async () => {
    await openHome(shellApi({ signOut: () => new Promise<Response>(() => {}) }))

    const { account, menu } = await openAccountMenu(/Ana/)
    const item = within(menu).getByRole('menuitem', { name: 'Cerrar sesión' })
    await userEvent.click(item)

    await waitFor(() => expect(item.getAttribute('aria-disabled')).toBe('true'))
    expect(account.getAttribute('aria-busy')).toBe('true')
    expect(screen.getByRole('menu')).toBeTruthy()
  })

  it('@id:companies-92-5 a sign-out that fails says so inside the menu and can be tried again', async () => {
    let calls = 0
    const { router } = await openHome(
      shellApi({
        signOut: () =>
          calls++ === 0
            ? new Response('down', { status: 503 })
            : new Response(null, { status: 204 }),
      }),
    )

    const { menu } = await openAccountMenu(/Ana/)
    await userEvent.click(within(menu).getByRole('menuitem', { name: 'Cerrar sesión' }))

    expect((await within(menu).findByRole('alert')).textContent).toBe(
      'Algo ha fallado. Vuelve a intentarlo.',
    )
    const item = within(menu).getByRole('menuitem', { name: 'Cerrar sesión' })
    expect(item.getAttribute('aria-disabled')).not.toBe('true')
    await userEvent.click(item)
    await waitFor(() => expect(router.state.location.pathname).toBe('/login'))
  })

  it('@id:companies-92-8 an account without a name shows its email, once, in place of the name', async () => {
    await openHome(shellApi({ name: null }))

    const { menu } = await openAccountMenu(/ana@example\.com/)

    expect(within(menu).getAllByText('ana@example.com')).toHaveLength(1)
  })

  it('@id:companies-92-7 the rail starts unfolded and is kept for the next visit', async () => {
    await openHome()

    await userEvent.click(screen.getByRole('button', { name: 'Plegar menú' }))
    expect(await screen.findByRole('button', { name: 'Desplegar menú' })).toBeTruthy()
    expect(localStorage.getItem(SIDEBAR_KEY)).not.toBeNull()
    cleanup()
    await openHome()

    expect(screen.getByRole('button', { name: 'Desplegar menú' })).toBeTruthy()
  })

  it('@id:companies-92-7 a browser that refuses storage still shows and folds the menu', async () => {
    const refuse = () => {
      throw new DOMException('denied', 'SecurityError')
    }
    vi.spyOn(Storage.prototype, 'getItem').mockImplementation(refuse)
    vi.spyOn(Storage.prototype, 'setItem').mockImplementation(refuse)
    await openHome()

    await userEvent.click(screen.getByRole('button', { name: 'Plegar menú' }))

    expect(await screen.findByRole('button', { name: 'Desplegar menú' })).toBeTruthy()
  })

  it('@id:companies-92-10 the first focus is «Saltar al contenido», which leads to the main content', async () => {
    await openHome()

    await userEvent.tab()

    const skip = screen.getByRole('link', { name: 'Saltar al contenido' })
    expect(document.activeElement).toBe(skip)
    expect(skip.getAttribute('href')).toBe('#content')
    expect(screen.getByRole('main').id).toBe('content')
  })

  it('@id:companies-92-10 the tab is titled with the page, the company and the app', async () => {
    await openHome()

    await waitFor(() => expect(document.title).toBe('Inicio · Northwind Logistics · worKampo'))
  })

  it('@id:companies-92-10 a subpage that does not exist is inside the shell, with nothing current and its own title', async () => {
    renderApp({ path: '/c/northwind/settings', answer: shellApi() })

    expect(await screen.findByRole('heading', { name: 'No encontramos esta página' })).toBeTruthy()
    expect(screen.getAllByRole('navigation').length).toBeGreaterThan(0)
    expect(
      screen.getAllByRole('link').filter((link) => link.getAttribute('aria-current') === 'page'),
    ).toHaveLength(0)
    await waitFor(() =>
      expect(document.title).toBe('No encontramos esta página · Northwind Logistics · worKampo'),
    )
  })

  it('@id:companies-92-11 a company that takes long to load shows the app loader', async () => {
    const slow = () =>
      new Promise<Response>((resolve) => setTimeout(() => resolve(Response.json(NORTHWIND)), 1000))
    renderApp({ path: '/c/northwind', answer: shellApi({ context: slow }) })

    expect(await screen.findByRole('status', { name: 'Cargando' })).toBeTruthy()
    expect(await screen.findByText(HOME)).toBeTruthy()
  })

  it('@id:companies-92-11 the home paints no empty h1 while the company loads', async () => {
    let load = () => {}
    const held = new Promise<Response>((resolve) => {
      load = () => resolve(Response.json(NORTHWIND))
    })
    renderApp({ path: '/c/northwind', answer: shellApi({ context: () => held }) })

    await screen.findByRole('status', { name: 'Cargando' })
    const emptyHeadings = () =>
      [...document.querySelectorAll('h1')].filter((h1) => !h1.textContent?.trim())
    expect(emptyHeadings()).toEqual([])
    load()

    expect(await screen.findByText(HOME)).toBeTruthy()
    expect(emptyHeadings()).toEqual([])
  })

  // «Reintentar» reloads the page, which jsdom cannot do: the browser check in
  // e2e/system-pages.e2e.ts proves it.
  it.fails('@id:companies-92-1 a company that cannot be loaded shows the system 500 without the shell', async () => {
    const context = () => problem({ status: 500, code: 'api.unexpected', reference: '7F3K-92QD' })
    renderApp({ path: '/c/northwind', answer: shellApi({ context }) })

    // The query retries a 500 three times (1 s, 2 s, 4 s) before the route gives up.
    const title = { level: 1, name: 'Algo ha ido mal' }
    expect(await screen.findByRole('heading', title, { timeout: 10_000 })).toBeTruthy()
    expect(screen.queryByRole('navigation')).toBeNull()
    expect(screen.getByText('7F3K-92QD').tagName).toBe('CODE')
    expect(screen.getByRole('button', { name: 'Reintentar' })).toBeTruthy()
    expect(screen.getByRole('link', { name: 'Ir al inicio' }).getAttribute('href')).toBe('/')
    expect(document.body.textContent).not.toContain('Northwind Logistics')
  }, 15_000)

  it.fails('@id:companies-90-12 a company I cannot open shows the system 404 without the shell', async () => {
    renderApp({ path: '/c/sol-bakery', answer: shellApi() })

    expect(
      await screen.findByRole('heading', { level: 1, name: 'Página no encontrada' }),
    ).toBeTruthy()
    expect(screen.queryByRole('navigation')).toBeNull()
  })
})
