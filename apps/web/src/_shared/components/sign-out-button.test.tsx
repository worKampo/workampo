import { cleanup, configure, screen } from '@testing-library/react'
import userEvent from '@testing-library/user-event'
import { afterEach, beforeAll, expect, it } from 'vitest'
import { initI18n } from '../i18n/i18n'
import { problem, renderApp } from '../testing/render-app'

// The first visit downloads the lazy screen and its translations; under a busy check that is slow.
configure({ asyncUtilTimeout: 5000 })

beforeAll(async () => {
  await initI18n(['es-ES'])
})

afterEach(cleanup)

it('@id:access-96-14 a sign-out that fails says so and lets the person try again', async () => {
  renderApp({ path: '/', answer: failingSignOutApi })
  const signOut = await screen.findByRole('button', { name: 'Cerrar sesión' })

  await userEvent.click(signOut)

  expect((await screen.findByRole('alert')).textContent).toBe(
    'Algo ha fallado. Vuelve a intentarlo.',
  )
  expect(screen.getByRole('button', { name: 'Cerrar sesión' })).toHaveProperty('disabled', false)
})

function failingSignOutApi(request: Request) {
  if (request.method === 'DELETE') return new Response('down', { status: 503 })

  return new URL(request.url).pathname === '/api/me'
    ? Response.json({ id: 'u1', email: 'ana@example.com' })
    : problem({ status: 404, code: 'access.unauthenticated' })
}
