import { QueryClient } from '@tanstack/react-query'
import { createMemoryHistory } from '@tanstack/react-router'
import { cleanup, configure, render, screen } from '@testing-library/react'
import userEvent from '@testing-library/user-event'
import { createApiClient } from '@workampo/app-core/_shared/api-client'
import { afterEach, beforeAll, describe, expect, it } from 'vitest'
import { initI18n } from '../../_shared/i18n/i18n'
import { AppProviders } from '../../_shared/providers/app-providers'
import { createAppRouter } from '../../_shared/router/create-app-router'
import { routeTree } from '../../route-tree'

// The first visit downloads the lazy screen and its translations; under a busy check that is slow.
configure({ asyncUtilTimeout: 5000 })

beforeAll(async () => {
  await initI18n(['es-ES'])
})

afterEach(cleanup)

describe('signing in with a code', () => {
  it('@id:access-96-1 the email leads to the code screen, which names it', async () => {
    renderApp('/login')

    await userEvent.type(await screen.findByRole('textbox'), 'ana@example.com')
    await userEvent.click(screen.getByRole('button', { name: 'Continuar' }))

    expect(await screen.findByText('ana@example.com')).toBeTruthy()
    expect(screen.getByRole('button', { name: 'Reenviar código' })).toBeTruthy()
  })

  it('@id:access-96-3 a wrong code says so and keeps the way to ask for another', async () => {
    renderApp('/login')
    await userEvent.type(await screen.findByRole('textbox'), 'ana@example.com')
    await userEvent.click(screen.getByRole('button', { name: 'Continuar' }))

    await userEvent.type(await screen.findByRole('textbox'), '111111{Enter}')

    expect(await screen.findByText(/no es válido/)).toBeTruthy()
    expect(screen.getByRole('button', { name: 'Reenviar código' })).toBeTruthy()
  })

  it('@id:access-96-2 the right code signs in and shows the empty state', async () => {
    renderApp('/login')
    await userEvent.type(await screen.findByRole('textbox'), 'ana@example.com')
    await userEvent.click(screen.getByRole('button', { name: 'Continuar' }))

    await userEvent.type(await screen.findByRole('textbox'), '424242{Enter}')

    expect(await screen.findByText('Aún no perteneces a ninguna empresa')).toBeTruthy()
  })

  it('@id:access-96-15 without a session / goes to /login', async () => {
    const { router } = renderApp('/')

    expect(await screen.findByRole('button', { name: 'Continuar' })).toBeTruthy()
    expect(router.state.location.pathname).toBe('/login')
  })

  it('@id:access-96-16 asks for no password', async () => {
    renderApp('/login')

    await screen.findByRole('button', { name: 'Continuar' })

    expect(document.querySelector('input[type="password"]')).toBeNull()
    expect(screen.queryByText(/contraseña/i)).toBeNull()
  })
})

// The API as the fake identity provider answers it locally; only the routes these tests use.
function renderApp(path: string) {
  const apiClient = createApiClient({
    baseUrl: 'https://app.test',
    clientVersion: 'test',
    fetch: async (input, init) => answer(new Request(input, init)),
  })
  const queryClient = new QueryClient()
  const router = createAppRouter({
    routeTree,
    context: { queryClient, apiClient },
    history: createMemoryHistory({ initialEntries: [path] }),
  })
  render(<AppProviders queryClient={queryClient} apiClient={apiClient} router={router} />)

  return { router }
}

async function answer(request: Request) {
  const { pathname } = new URL(request.url)
  if (pathname === '/api/sign-in-codes') return new Response(null, { status: 202 })
  if (pathname === '/api/me') return problem({ status: 401, code: 'access.unauthenticated' })

  const { code } = await request.json<{ code: string }>()
  if (code === '424242')
    return Response.json({ user: { id: 'u1', email: 'ana@example.com' } }, { status: 201 })

  return problem({ status: 400, code: 'access.invalid_code' })
}

function problem({ status, code }: { status: number; code: string }) {
  return Response.json({ type: 'about:blank', status, code }, { status })
}
