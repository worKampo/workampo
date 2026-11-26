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
    const { pathname, searchParams } = new URL(request.url)
    if (pathname === '/api/me') return Response.json({ id: 'u1', email: 'ana@example.com', name })
    if (pathname === '/api/companies' && request.method === 'GET')
      return Response.json({ items: [], total: 0 })
    if (pathname === '/api/companies/availability') {
      const slug = searchParams.get('slug') ?? ''
      return Response.json({ available: !taken.includes(slug) })
    }
    if (pathname === '/api/companies' && request.method === 'POST') {
      const body = await request.json<{ slug: string; name: string }>()
      created.push({ url: request.url, body, key: request.headers.get('Idempotency-Key') })
      if (create) return create()
      return Response.json(
        {
          id: 'c1',
          slug: body.slug,
          name: body.name,
          url: `${window.location.origin}/c/${body.slug}/`,
        },
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
// The text a field links to its control: its help or its error.
const messageOf = (control: HTMLElement) =>
  document.getElementById(control.getAttribute('aria-describedby') ?? '')?.textContent
const createButton = () => screen.getByRole('button', { name: 'Crear empresa' })

// The ids a control links to, status first and fixed hint last.
const describedBy = (control: HTMLElement) =>
  (control.getAttribute('aria-describedby') ?? '').split(' ').filter(Boolean)

const isPost = (request: Request) =>
  new URL(request.url).pathname === '/api/companies' && request.method === 'POST'

// A promise the test opens, to hold an answer of the API while it looks at the screen.
function gate() {
  let open = () => {}
  const opened = new Promise<void>((resolve) => {
    open = resolve
  })
  return { open, opened }
}

async function typeSlug(slug: string) {
  await userEvent.clear(slugField())
  await userEvent.type(slugField(), slug)
}

describe('creating a company', () => {
  it('@id:companies-90-1 creating the company leads to its home', async () => {
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
    // Types two fields and then loads the company shell's lazy chunk: past 5 s under a busy check.
  }, 10_000)

  it('@id:companies-91-3 the start without a company opens the creation form directly', async () => {
    const { router } = renderApp({ path: '/', answer: companiesApi({ name: 'Ana' }) })

    expect(await nameField()).toBeTruthy()
    expect(router.state.location.pathname).toBe('/companies/new')
  })

  it('@id:companies-90-2 the URL is proposed from the name without accents and is available', async () => {
    renderApp({ path: '/companies/new', answer: companiesApi() })

    await userEvent.type(await nameField(), 'Clínica Norte')

    await waitFor(() => expect(slugField()).toHaveProperty('value', 'clinica-norte'))
    expect(await screen.findByText(/^Disponible/)).toBeTruthy()
  })

  it('@id:companies-90-3 a URL another company has is not available and nothing is sent', async () => {
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

  it('@id:companies-90-3 sending a URL another company has moves focus to it', async () => {
    renderApp({ path: '/companies/new', answer: companiesApi({ taken: ['clinica-norte'] }) })

    await userEvent.type(await nameField(), 'Clínica Norte')
    await userEvent.type(screen.getByLabelText('Tu nombre'), 'Ana')
    await screen.findByText(/^No disponible/)
    await userEvent.click(createButton())

    await waitFor(() => expect(document.activeElement).toBe(slugField()))
  })

  it('@id:companies-90-4 a reserved URL says so and nothing is sent', async () => {
    const created: Created[] = []
    renderApp({ path: '/companies/new', answer: companiesApi({ created }) })

    await userEvent.type(await nameField(), 'Reservada')
    await typeSlug('api')

    expect(await screen.findByText(/reservad/i)).toBeTruthy()
    await userEvent.click(createButton())
    expect(created).toEqual([])
  })

  for (const slug of ['ab', 'mi--empresa', '-norte', 'norte-stg'])
    it(`@id:companies-90-5 the URL "${slug}" has an invalid format`, async () => {
      const created: Created[] = []
      renderApp({ path: '/companies/new', answer: companiesApi({ created }) })

      await userEvent.type(await nameField(), 'Formato')
      await typeSlug(slug)

      expect(await screen.findByText(/^Usa de 3 a 40 caracteres/)).toBeTruthy()
      await userEvent.click(createButton())
      expect(created).toEqual([])
    })

  it('@id:companies-90-6 there is no terms checkbox', async () => {
    renderApp({ path: '/companies/new', answer: companiesApi() })

    await nameField()

    expect(screen.queryAllByRole('checkbox')).toEqual([])
    expect(screen.queryByText(/términos|condiciones|DPA/i)).toBeNull()
  })

  it('@id:companies-90-7 the chosen default language is sent', async () => {
    const created: Created[] = []
    renderApp({ path: '/companies/new', answer: companiesApi({ name: 'Ana', created }) })

    await userEvent.type(await nameField(), 'Northwind Logistics')
    await userEvent.selectOptions(screen.getByLabelText('Idioma por defecto'), 'Español')
    await screen.findByText(/^Disponible/)
    await userEvent.click(createButton())

    await waitFor(() => expect(created[0]?.body).toMatchObject({ defaultLanguage: 'es' }))
  })

  it('@id:companies-90-8 an account without a name is asked for it and sends it', async () => {
    const created: Created[] = []
    renderApp({ path: '/companies/new', answer: companiesApi({ name: null, created }) })

    await userEvent.type(await nameField(), 'Northwind Logistics')
    await userEvent.type(screen.getByLabelText('Tu nombre'), 'Ana')
    await screen.findByText(/^Disponible/)
    await userEvent.click(createButton())

    await waitFor(() => expect(created[0]?.body).toMatchObject({ userName: 'Ana' }))
  })

  it('@id:companies-90-9 an account with a name is not asked for it', async () => {
    renderApp({ path: '/companies/new', answer: companiesApi({ name: 'Ana' }) })

    await nameField()

    expect(screen.queryByLabelText('Tu nombre')).toBeNull()
  })

  it('@id:companies-90-10 a URL taken while sending shows as not available', async () => {
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

  it('@id:companies-90-8 missing names show at their own field', async () => {
    const created: Created[] = []
    renderApp({ path: '/companies/new', answer: companiesApi({ name: null, created }) })

    await nameField()
    await userEvent.click(createButton())

    const companyName = await nameField()
    const yourName = screen.getByLabelText('Tu nombre')
    await waitFor(() => expect(companyName.getAttribute('aria-invalid')).toBe('true'))
    expect(messageOf(companyName)).toBe('Escribe el nombre de la empresa.')
    expect(yourName.getAttribute('aria-invalid')).toBe('true')
    expect(messageOf(yourName)).toBe('Escribe tu nombre.')
    expect(screen.queryByRole('alert')).toBeNull()
    expect(created).toEqual([])
  })

  it('@id:companies-91-5 "Volver a mis empresas" leads back to the picker without creating anything', async () => {
    const created: Created[] = []
    const { router } = renderApp({
      path: '/companies/new',
      answer: companiesApi({ name: 'Ana', created }),
    })

    await userEvent.type(await nameField(), 'Northwind Logistics')
    expect(screen.queryByRole('link', { name: 'Cancelar' })).toBeNull()
    await userEvent.click(screen.getByRole('link', { name: 'Volver a mis empresas' }))

    expect(await screen.findByRole('link', { name: 'Crear una empresa nueva' })).toBeTruthy()
    expect(router.state.location.pathname).toBe('/companies')
    expect(created).toEqual([])
  })

  it('@id:companies-91-5 the creation form does not apply the destination: it stays with one company or more', async () => {
    const { router } = renderApp({
      path: '/companies/new',
      answer: async (request) =>
        new URL(request.url).pathname === '/api/companies' && request.method === 'GET'
          ? Response.json({
              items: [
                {
                  name: 'Northwind',
                  slug: 'northwind',
                  url: `${window.location.origin}/c/northwind/`,
                },
              ],
              total: 1,
            })
          : companiesApi({ name: 'Ana' })(request),
    })

    expect(await nameField()).toBeTruthy()
    expect(screen.getByRole('link', { name: 'Volver a mis empresas' })).toBeTruthy()
    expect(router.state.location.pathname).toBe('/companies/new')
  })

  it('@id:companies-90-13 without a session the creation screen leads to /login', async () => {
    const { router } = renderApp({
      path: '/companies/new',
      answer: () => problem({ status: 401, code: 'access.unauthenticated' }),
    })

    expect(await screen.findByRole('button', { name: 'Continuar' })).toBeTruthy()
    expect(router.state.location.pathname).toBe('/login')
  })

  it('@id:companies-90-13 without a session the creation screen leads to /login and back to it', async () => {
    const { router } = renderApp({
      path: '/companies/new',
      answer: () => problem({ status: 401, code: 'access.unauthenticated' }),
    })

    expect(await screen.findByRole('button', { name: 'Continuar' })).toBeTruthy()
    expect(router.state.location.search).toEqual({ returnTo: '/companies/new' })
  })
})

describe('the polished creation screen', () => {
  it('@id:companies-166-1 explains what a company is above the form', async () => {
    renderApp({ path: '/', answer: companiesApi({ name: 'Ana' }) })

    await nameField()
    const intro = screen.getByText(/^Una empresa es el espacio de tu equipo en worKampo/)
    expect(intro.textContent).toBe(
      'Una empresa es el espacio de tu equipo en worKampo, con su propia dirección. Serás su propietario y más adelante podrás invitar a tu equipo.',
    )
    const form = document.querySelector('form')
    expect(form?.contains(intro)).toBe(false)
    expect(
      form && intro.compareDocumentPosition(form) & Node.DOCUMENT_POSITION_FOLLOWING,
    ).toBeTruthy()
  })

  it('@id:companies-166-2 the URL has the …/c/ prefix and a fixed hint before any error', async () => {
    renderApp({ path: '/companies/new', answer: companiesApi({ name: 'Ana' }) })

    await nameField()
    const prefix = screen.getByText('…/c/')
    const hint = screen.getByText(
      'Minúsculas, números y guiones; algunos nombres están reservados.',
    )
    expect(prefix.getAttribute('aria-hidden')).toBe('true')
    expect(prefix.getAttribute('dir')).toBe('ltr')
    expect(
      prefix.compareDocumentPosition(slugField()) & Node.DOCUMENT_POSITION_FOLLOWING,
    ).toBeTruthy()
    expect(slugField().getAttribute('aria-invalid')).toBeNull()
    expect(describedBy(slugField()).at(-1)).toBe(hint.id)

    await typeSlug('ab')
    await waitFor(() => expect(slugField().getAttribute('aria-invalid')).toBe('true'))
    expect(hint.isConnected).toBe(true)
  })

  it('@id:companies-166-3 a free URL shows "Disponible" as the positive state', async () => {
    renderApp({ path: '/companies/new', answer: companiesApi({ name: 'Ana' }) })

    await userEvent.type(await nameField(), 'Clínica Norte')

    const available = await screen.findByText(/^Disponible/)
    expect(available.closest('[class*="text-pos"]')).not.toBeNull()
    const status = document.getElementById(describedBy(slugField())[0] ?? '')
    expect(status?.textContent).toMatch(/^Disponible/)
  })

  it('@id:companies-166-4 while creating, the button keeps the focus and says "Creando…"', async () => {
    const hold = gate()
    const api = companiesApi({ name: 'Ana' })
    renderApp({
      path: '/companies/new',
      answer: async (request) => {
        if (isPost(request)) await hold.opened
        return api(request)
      },
    })
    await userEvent.type(await nameField(), 'Northwind Logistics')
    await screen.findByText(/^Disponible/)

    await userEvent.click(createButton())

    const busy = await screen.findByRole('button', { name: 'Creando…' })
    expect(document.activeElement).toBe(busy)
    expect(busy.getAttribute('aria-busy')).toBe('true')
    expect(busy.getAttribute('aria-disabled')).toBe('true')
    expect(busy.hasAttribute('disabled')).toBe(false)
    hold.open()
    expect(await screen.findByText('Bienvenido a Northwind Logistics')).toBeTruthy()
  }, 10_000)

  it('@id:companies-166-5 a server rejection shows a negative banner first in the form, focused, gone on the next submit', async () => {
    let calls = 0
    const second = gate()
    const api = companiesApi({ name: 'Ana' })
    renderApp({
      path: '/companies/new',
      answer: async (request) => {
        if (isPost(request) && ++calls === 1) return problem({ status: 500, code: 'internal' })
        if (isPost(request)) await second.opened
        return api(request)
      },
    })
    await userEvent.type(await nameField(), 'Northwind Logistics')
    await screen.findByText(/^Disponible/)

    await userEvent.click(createButton())

    const banner = await screen.findByRole('alert')
    expect(document.querySelector('form')?.firstElementChild).toBe(banner)
    expect(banner.tabIndex).toBe(-1)
    await waitFor(() => expect(document.activeElement).toBe(banner))

    await userEvent.click(createButton())

    await waitFor(() => expect(screen.queryByRole('alert')).toBeNull())
    second.open()
  }, 10_000)

  it('@id:companies-166-5 a failed availability check shows the banner without moving focus', async () => {
    const api = companiesApi({ name: 'Ana' })
    renderApp({
      path: '/companies/new',
      answer: (request) =>
        new URL(request.url).pathname === '/api/companies/availability'
          ? problem({ status: 500, code: 'internal' })
          : api(request),
    })
    const name = await nameField()

    await userEvent.type(name, 'Northwind Logistics')

    expect(await screen.findByRole('alert')).toBeTruthy()
    expect(document.activeElement).toBe(name)
  }, 10_000)

  it('@id:companies-166-5 a URL taken while sending shows at its field and takes focus, with no banner', async () => {
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
    await waitFor(() => expect(document.activeElement).toBe(slugField()))
    expect(screen.queryByRole('alert')).toBeNull()
  }, 10_000)

  it('@id:companies-90-8 every field is required, and the URL and name carry their input limits', async () => {
    renderApp({ path: '/companies/new', answer: companiesApi({ name: null }) })

    const name = await nameField()
    const slug = slugField()
    for (const field of [name, slug, screen.getByLabelText('Tu nombre')]) {
      expect(field.hasAttribute('required'), field.id).toBe(true)
      expect(field.getAttribute('aria-required'), field.id).toBe('true')
    }
    expect(slug.getAttribute('spellcheck')).toBe('false')
    expect(slug.getAttribute('autocapitalize')).toBe('none')
    expect(slug.getAttribute('autocorrect')).toBe('off')
    expect(slug.getAttribute('autocomplete')).toBe('off')
    expect(slug.getAttribute('maxlength')).toBe('40')
    expect(name.getAttribute('maxlength')).toBe('80')
  })
})
