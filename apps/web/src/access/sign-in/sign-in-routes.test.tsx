import { cleanup, configure, screen } from '@testing-library/react'
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

  it('@id:access-96-2 the right code signs in and shows the empty state', async () => {
    renderApp({ path: '/login', answer: signInApi })
    await userEvent.type(await screen.findByRole('textbox'), 'ana@example.com')
    await userEvent.click(screen.getByRole('button', { name: 'Continuar' }))

    await userEvent.type(await screen.findByRole('textbox'), '424242{Enter}')

    expect(await screen.findByText('Aún no perteneces a ninguna empresa')).toBeTruthy()
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
