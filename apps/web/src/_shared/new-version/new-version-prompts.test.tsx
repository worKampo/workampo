import { createRoute } from '@tanstack/react-router'
import { act, cleanup, configure, fireEvent, screen, waitFor, within } from '@testing-library/react'
import { afterEach, beforeAll, describe, expect, it } from 'vitest'
import { initI18n } from '../i18n/i18n'
import { type RouterContext, rootRoute } from '../router/root-route'
import {
  manualTimers,
  memoryStorage,
  problem,
  recordingLocation,
  renderApp,
  servedVersion,
} from '../testing/render-app'

// The notice and the dialog of a new version (docs/design/patterns.md, "New version available").
configure({ asyncUtilTimeout: 5000 })

beforeAll(async () => {
  await initI18n(['es-ES'])
})

afterEach(cleanup)

// Made-up hashes and dates (ADR-0043).
const OWN = 'a1b2c3d4e5f6'
const NEW = '9f8e7d6c5b4a'
const BUILD = '2026-01-01T00:00:00Z'
const LATER = '2100-01-01T00:00:00Z'
const NOTICE_AFTER = 30 * 60_000
const NOTICE = 'Hay una versión nueva'
const DIALOG = { name: 'Recarga para continuar' } as const
const NOT_FOUND = { level: 1, name: 'Página no encontrada' } as const
const FAILED = { level: 1, name: 'Algo ha ido mal' } as const

const askTheApi = async ({ context }: { context: RouterContext }) => {
  await context.apiClient.api.me.$get()
}

// Test-only screens that ask the API, one that then fails and one that then is not found.
// addChildren replaces the root's children in place, so renderApp's routeTree gets them too.
rootRoute.addChildren([
  ...(rootRoute.children as never[]),
  createRoute({ getParentRoute: () => rootRoute, path: '/v/$n', loader: askTheApi }),
  createRoute({
    getParentRoute: () => rootRoute,
    path: '/v-boom',
    loader: async (match) => {
      await askTheApi(match)
      throw new Error('internal-detail')
    },
  }),
])

const signedOut = () => problem({ status: 401, code: 'access.unauthenticated' })

function visit({ path, served }: { path: string; served: Record<string, string> }) {
  const recorded = recordingLocation()
  const { timers, advance } = manualTimers()
  const answered = { count: 0 }
  const { router } = renderApp({
    path,
    answer: servedVersion(
      () => {
        answered.count++
        return signedOut()
      },
      () => served,
    ),
    version: OWN,
    buildDate: BUILD,
    storage: memoryStorage(),
    location: recorded.location,
    timers,
  })
  const settled = async () => {
    await waitFor(() => expect(answered.count).toBeGreaterThan(0))
    await waitFor(() => expect(router.state.status).toBe('idle'))
  }
  const pass = (ms: number) =>
    act(() => {
      advance(ms)
    })

  return { router, ...recorded, settled, pass }
}

describe('the notice of a new version', () => {
  it.fails('E5 shows 30 minutes after the new version is detected, in a status that was already there', async () => {
    const app = visit({ path: '/v/0', served: { 'X-App-Version': NEW } })
    await app.settled()
    const statuses = screen.queryAllByRole('status')

    await app.pass(NOTICE_AFTER - 1000)
    expect(screen.queryByText(NOTICE)).toBeNull()
    await app.pass(1000)

    const notice = await screen.findByText(NOTICE)
    const status = notice.closest('[role="status"]')
    expect(status).not.toBeNull()
    expect(statuses).toContain(status)
    expect(within(status as HTMLElement).getByRole('button', { name: 'Recargar' })).toBeTruthy()
    expect(status?.contains(document.activeElement)).toBe(false)
    expect(within(status as HTMLElement).queryByRole('button', { name: /cerrar/i })).toBeNull()
  })

  it.fails('E5 «Recargar» reloads the page where it is', async () => {
    const app = visit({ path: '/v/0', served: { 'X-App-Version': NEW } })
    await app.settled()
    await app.pass(NOTICE_AFTER)

    fireEvent.click(await screen.findByRole('button', { name: 'Recargar' }))

    expect(app.reloads.count).toBe(1)
    expect(app.assigned).toEqual([])
  })

  it.fails('E5 shows on a screen, never on the root 404 or 500', async () => {
    const screenApp = visit({ path: '/v/0', served: { 'X-App-Version': NEW } })
    await screenApp.settled()
    await screenApp.pass(NOTICE_AFTER)
    expect(await screen.findByText(NOTICE)).toBeTruthy()
    cleanup()

    const failing = visit({ path: '/v-boom', served: { 'X-App-Version': NEW } })
    await screen.findByRole('heading', FAILED)
    await failing.pass(NOTICE_AFTER)
    expect(screen.queryByText(NOTICE)).toBeNull()
    cleanup()

    const missing = visit({ path: '/no-existe', served: { 'X-App-Version': NEW } })
    await screen.findByRole('heading', NOT_FOUND)
    await missing.pass(NOTICE_AFTER)
    expect(screen.queryByText(NOTICE)).toBeNull()
  })
})

describe('the minimum-version dialog', () => {
  it.fails('E6 a minimum later than my build shows the dialog with one button, without the notice', async () => {
    const app = visit({
      path: '/v/0',
      served: { 'X-App-Version': NEW, 'X-Min-Client-Version': LATER },
    })
    await app.settled()
    await app.pass(NOTICE_AFTER)

    const dialog = await screen.findByRole('alertdialog', DIALOG)
    expect(
      within(dialog).getByText('Hay una versión nueva de worKampo y esta ya no se puede usar.'),
    ).toBeTruthy()
    expect(
      within(dialog)
        .getAllByRole('button')
        .map((button) => button.textContent),
    ).toEqual(['Recargar'])
    expect(screen.queryByText(NOTICE)).toBeNull()
  })

  it.fails('E6 R7 it reloads only when its button is pressed, which then stays busy', async () => {
    const app = visit({ path: '/v/0', served: { 'X-Min-Client-Version': LATER } })
    await app.settled()
    const dialog = await screen.findByRole('alertdialog', DIALOG)
    await app.pass(2 * NOTICE_AFTER)
    expect(app.reloads.count + app.assigned.length).toBe(0)

    const reload = within(dialog).getByRole('button', { name: 'Recargar' })
    fireEvent.click(reload)

    expect(app.reloads.count).toBe(1)
    expect(reload.getAttribute('aria-busy')).toBe('true')
    expect(screen.getByRole('alertdialog', DIALOG)).toBe(dialog)
  })

  it.fails('R7 an invalid, equal or earlier minimum shows no dialog', async () => {
    for (const minimum of [
      '2026-13-40T00:00:00Z',
      'tomorrow',
      '',
      '<b>',
      BUILD,
      '2025-01-01T00:00:00Z',
    ]) {
      const app = visit({ path: '/v/0', served: { 'X-Min-Client-Version': minimum } })
      await app.settled()
      expect(screen.queryByRole('alertdialog'), minimum).toBeNull()
      cleanup()
    }
    // Asserted apart: with no dialog at all the loop above passes.
    visit({ path: '/v/0', served: { 'X-Min-Client-Version': LATER } })
    expect(await screen.findByRole('alertdialog', DIALOG)).toBeTruthy()
  })

  it.fails('E6 the root 404 and 500 hide the dialog', async () => {
    const app = visit({ path: '/v/0', served: { 'X-Min-Client-Version': LATER } })
    await app.settled()
    await screen.findByRole('alertdialog', DIALOG)

    await act(async () => {
      app.router.history.push('/no-existe')
    })

    await screen.findByRole('heading', NOT_FOUND)
    expect(screen.queryByRole('alertdialog')).toBeNull()

    await act(async () => {
      app.router.history.push('/v-boom')
    })

    await screen.findByRole('heading', FAILED)
    expect(screen.queryByRole('alertdialog')).toBeNull()
  })
})
