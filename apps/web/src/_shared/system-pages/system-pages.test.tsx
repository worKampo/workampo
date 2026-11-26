import { cleanup, configure, screen, waitFor } from '@testing-library/react'
import userEvent from '@testing-library/user-event'
import { afterEach, beforeAll, describe, expect, it } from 'vitest'
import { initI18n } from '../i18n/i18n'
import { problem, renderApp } from '../testing/render-app'

// Ticket 93: the root's 404 and 500 (docs/design/components.md, "System page" and "Error reference").
configure({ asyncUtilTimeout: 5000 })

beforeAll(async () => {
  await initI18n(['es-ES'])
})

afterEach(cleanup)

// A made-up reference (ADR-0043).
const REFERENCE = '7F3K-92QD'
const NORTHWIND = { name: 'Northwind Logistics', slug: 'northwind', role: 'owner' }
const NOT_FOUND = { level: 1, name: 'Página no encontrada' } as const
const FAILED = { level: 1, name: 'Algo ha ido mal' } as const
// The query retries a 5xx or a network failure three times (1 s, 2 s, 4 s) before the route fails.
const AFTER_RETRIES = { timeout: 10_000 }

// Signed in; the company context of northwind answers `context`.
function failingCompany(context: () => Response | Promise<Response>) {
  return (request: Request) => {
    const { pathname } = new URL(request.url)
    if (pathname === '/api/me')
      return Response.json({ id: 'u1', email: 'ana@example.com', name: 'Ana' })
    if (pathname === '/api/t/northwind/') return context()

    return Response.json(NORTHWIND)
  }
}

const me = (request: Request) =>
  new URL(request.url).pathname === '/api/me'
    ? Response.json({ id: 'u1', email: 'ana@example.com', name: 'Ana' })
    : problem({ status: 404, code: 'api.not_found' })

describe('the root 404', () => {
  it.fails('SystemPage E1 a path that does not exist shows «Página no encontrada» and leads home', async () => {
    const { router } = renderApp({ path: '/no-existe', answer: me })

    const heading = await screen.findByRole('heading', NOT_FOUND)
    expect(
      screen.getByText('La dirección puede estar mal escrita o la página se ha movido.'),
    ).toBeTruthy()
    expect(screen.getByText('Error 404')).toBeTruthy()
    expect(screen.queryByRole('navigation')).toBeNull()
    expect(screen.queryByRole('button', { name: /atrás/i })).toBeNull()
    expect(document.activeElement).toBe(heading)
    await waitFor(() => expect(document.title).toBe('Página no encontrada · worKampo'))

    await userEvent.click(screen.getByRole('link', { name: 'Ir al inicio' }))
    await waitFor(() => expect(router.state.location.pathname).not.toBe('/no-existe'))
  })

  it.fails('X2 «Ir al inicio» is always /, whatever returnTo says', async () => {
    renderApp({ path: '/no-existe?returnTo=https://evil.example', answer: me })

    await screen.findByRole('heading', NOT_FOUND)

    expect(screen.getByRole('link', { name: 'Ir al inicio' }).getAttribute('href')).toBe('/')
    expect(document.body.innerHTML).not.toContain('evil.example')
  })

  it.fails('X1 nothing from the path or the query reaches the page', async () => {
    renderApp({
      path: '/no-existe/<img src=x onerror=alert(1)>?q=<script>alert(1)</script>',
      answer: me,
    })

    await screen.findByRole('heading', NOT_FOUND)

    const html = document.body.innerHTML
    for (const echo of ['no-existe', 'onerror', 'img', 'script', 'alert']) {
      expect(html).not.toContain(echo)
    }
    expect(document.querySelector('img')).toBeNull()
    await waitFor(() => expect(document.title).toBe('Página no encontrada · worKampo'))
  })
})

describe('the root 500', () => {
  it.fails('SystemPage E2 a server failure shows «Algo ha ido mal» with the reference of the API, its title and tab order', async () => {
    renderApp({
      path: '/c/northwind',
      answer: failingCompany(() =>
        problem({ status: 500, code: 'api.unexpected', reference: REFERENCE }),
      ),
    })

    const heading = await screen.findByRole('heading', FAILED, AFTER_RETRIES)
    expect(
      screen.getByText('Ha fallado algo por nuestra parte. Vuelve a intentarlo en unos minutos.'),
    ).toBeTruthy()
    expect(screen.getByText('Error 500')).toBeTruthy()
    const code = screen.getByText(REFERENCE)
    expect(code.tagName).toBe('CODE')
    expect(code.parentElement?.textContent).toContain(`Referencia: ${REFERENCE}`)
    expect(screen.queryByRole('navigation')).toBeNull()
    expect(document.body.textContent).not.toContain('Ya lo sabemos')
    await waitFor(() => expect(document.title).toBe('Algo ha ido mal · worKampo'))

    expect(document.activeElement).toBe(heading)
    await userEvent.tab()
    expect(document.activeElement).toBe(
      screen.getByRole('button', { name: 'Copiar la referencia' }),
    )
    await userEvent.tab()
    expect(document.activeElement).toBe(screen.getByRole('button', { name: 'Reintentar' }))
    await userEvent.tab()
    const home = screen.getByRole('link', { name: 'Ir al inicio' })
    expect(document.activeElement).toBe(home)
    expect(home.getAttribute('href')).toBe('/')
  }, 15_000)

  it.fails('W1 decision 3: a network failure shows no reference, no message and no stack', async () => {
    renderApp({
      path: '/c/northwind',
      answer: failingCompany(() => {
        throw new Error('internal-detail')
      }),
    })

    await screen.findByRole('heading', FAILED, AFTER_RETRIES)

    const text = document.body.textContent ?? ''
    expect(text).not.toContain('internal-detail')
    expect(text).not.toContain('at ')
    expect(text).not.toContain('Referencia')
    expect(screen.queryByRole('button', { name: 'Copiar la referencia' })).toBeNull()
    expect(screen.getByRole('button', { name: 'Reintentar' })).toBeTruthy()
  }, 15_000)

  it.fails('decision 2: an unexpected 4xx shows the 500 with no reference, even if it brings one', async () => {
    renderApp({
      path: '/c/northwind',
      answer: failingCompany(() =>
        Response.json(
          { type: 'about:blank', status: 409, code: 'companies.other', reference: REFERENCE },
          { status: 409 },
        ),
      ),
    })

    await screen.findByRole('heading', FAILED)

    expect(document.body.textContent).not.toContain(REFERENCE)
    expect(document.body.textContent).not.toContain('Referencia')
  })
})
