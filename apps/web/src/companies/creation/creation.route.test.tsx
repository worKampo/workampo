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

type Created = { url: string; body: unknown; key: string | null }

// The API as it answers the creation screen; `taken` slugs are not available.
function companiesApi({
  name = null,
  taken = [],
  created = [],
  create,
}: {
  name?: string | null
  taken?: string[]
  created?: Created[]
  create?: () => Response
} = {}) {
  return async (request: Request) => {
    const { pathname } = new URL(request.url)
    if (pathname === '/api/me') return Response.json({ id: 'u1', email: 'ana@example.com', name })
    if (pathname === '/api/companies/availability') {
      const slug = decodeURIComponent(pathname.split('/').at(-1) ?? '')
      return Response.json({ available: !taken.includes(slug) })
    }
    if (pathname === '/api/companies' && request.method === 'POST') {
      const body = await request.json<{ slug: string; name: string }>()
      created.push({ url: request.url, body, key: request.headers.get('Idempotency-Key') })
      if (create) return create()
      return Response.json(
        { id: 'c1', slug: body.slug, name: body.name, url: `https://app.test/c/${body.slug}/` },
        { status: 201 },
      )
    }
    if (pathname.startsWith('/api/t/')) {
      const slug = pathname.split('/')[3]
      return Response.json({ name: 'Northwind Logistics', slug, role: 'owner' })
    }

    return problem({ status: 404, code: 'companies.not_found' })
  }
}

const nameField = () => screen.findByLabelText('Nombre de la empresa')
const slugField = () => screen.getByLabelText(/URL/)
const createButton = () => screen.getByRole('button', { name: 'Crear empresa' })

async function typeSlug(slug: string) {
  await userEvent.clear(slugField())
  await userEvent.type(slugField(), slug)
}

describe('creating a company', () => {
  it.fails('@id:companies-90-1 creating the company leads to its home', async () => {
    const created: Created[] = []
    const { router } = renderApp({ path: '/companies/new', answer: companiesApi({ created }) })

    await userEvent.type(await nameField(), 'Northwind Logistics')
    await userEvent.type(screen.getByLabelText('Tu nombre'), 'Ana')
    expect(await screen.findByText(/^Disponible/)).toBeTruthy()
    await userEvent.click(createButton())

    expect(await screen.findByText('Bienvenido a Northwind Logistics')).toBeTruthy()
    expect(router.state.location.pathname).toMatch(/^\/c\/northwind-logistics\/?$/)
    expect(created).toHaveLength(1)
    expect(created[0]?.key).toMatch(/^[0-9a-f-]{36}$/)
  })

  it.fails('@id:companies-90-1 the home without a company links to the creation screen', async () => {
    const { router } = renderApp({ path: '/', answer: companiesApi({ name: 'Ana' }) })

    await userEvent.click(await screen.findByRole('link', { name: 'Crear empresa' }))

    expect(await nameField()).toBeTruthy()
    expect(router.state.location.pathname).toBe('/companies/new')
  })

  it.fails('@id:companies-90-2 the URL is proposed from the name without accents and is available', async () => {
    renderApp({ path: '/companies/new', answer: companiesApi() })

    await userEvent.type(await nameField(), 'Clínica Norte')

    await waitFor(() => expect(slugField()).toHaveProperty('value', 'clinica-norte'))
    expect(await screen.findByText(/^Disponible/)).toBeTruthy()
  })

  it.fails('@id:companies-90-3 a URL another company has is not available and nothing is sent', async () => {
    const created: Created[] = []
    renderApp({
      path: '/companies/new',
      answer: companiesApi({ taken: ['clinica-norte'], created }),
    })

    await userEvent.type(await nameField(), 'Clínica Norte')
    await userEvent.type(screen.getByLabelText('Tu nombre'), 'Ana')

    expect(await screen.findByText(/^No disponible/)).toBeTruthy()
    await userEvent.click(createButton())
    expect(created).toEqual([])
  })

  it.fails('@id:companies-90-4 a reserved URL says so and nothing is sent', async () => {
    const created: Created[] = []
    renderApp({ path: '/companies/new', answer: companiesApi({ created }) })

    await userEvent.type(await nameField(), 'Reservada')
    await typeSlug('api')

    expect(await screen.findByText(/reservad/i)).toBeTruthy()
    await userEvent.click(createButton())
    expect(created).toEqual([])
  })

  for (const slug of ['ab', 'mi--empresa', '-norte', 'norte-stg'])
    it.fails(`@id:companies-90-5 the URL "${slug}" has an invalid format`, async () => {
      const created: Created[] = []
      renderApp({ path: '/companies/new', answer: companiesApi({ created }) })

      await userEvent.type(await nameField(), 'Formato')
      await typeSlug(slug)

      expect(await screen.findByText(/formato no es válido/i)).toBeTruthy()
      await userEvent.click(createButton())
      expect(created).toEqual([])
    })

  it.fails('@id:companies-90-6 there is no terms checkbox', async () => {
    renderApp({ path: '/companies/new', answer: companiesApi() })

    await nameField()

    expect(screen.queryAllByRole('checkbox')).toEqual([])
    expect(screen.queryByText(/términos|condiciones|DPA/i)).toBeNull()
  })

  it.fails('@id:companies-90-7 the chosen default language is sent', async () => {
    const created: Created[] = []
    renderApp({ path: '/companies/new', answer: companiesApi({ name: 'Ana', created }) })

    await userEvent.type(await nameField(), 'Northwind Logistics')
    await userEvent.selectOptions(screen.getByLabelText('Idioma por defecto'), 'Español')
    await screen.findByText(/^Disponible/)
    await userEvent.click(createButton())

    await waitFor(() => expect(created[0]?.body).toMatchObject({ defaultLanguage: 'es' }))
  })

  it.fails('@id:companies-90-8 an account without a name is asked for it and sends it', async () => {
    const created: Created[] = []
    renderApp({ path: '/companies/new', answer: companiesApi({ name: null, created }) })

    await userEvent.type(await nameField(), 'Northwind Logistics')
    await userEvent.type(screen.getByLabelText('Tu nombre'), 'Ana')
    await screen.findByText(/^Disponible/)
    await userEvent.click(createButton())

    await waitFor(() => expect(created[0]?.body).toMatchObject({ userName: 'Ana' }))
  })

  it.fails('@id:companies-90-9 an account with a name is not asked for it', async () => {
    renderApp({ path: '/companies/new', answer: companiesApi({ name: 'Ana' }) })

    await nameField()

    expect(screen.queryByLabelText('Tu nombre')).toBeNull()
  })

  it.fails('@id:companies-90-10 a URL taken while sending shows as not available', async () => {
    renderApp({
      path: '/companies/new',
      answer: companiesApi({
        name: 'Ana',
        create: () => problem({ status: 409, code: 'companies.slug_taken' }),
      }),
    })

    await userEvent.type(await nameField(), 'Sol')
    await screen.findByText(/^Disponible/)
    await userEvent.click(createButton())

    expect(await screen.findByText(/^No disponible/)).toBeTruthy()
  })

  it.fails('@id:companies-90-13 without a session the creation screen leads to /login', async () => {
    const { router } = renderApp({
      path: '/companies/new',
      answer: () => problem({ status: 401, code: 'access.unauthenticated' }),
    })

    expect(await screen.findByRole('button', { name: 'Continuar' })).toBeTruthy()
    expect(router.state.location.pathname).toBe('/login')
  })
})
