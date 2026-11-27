import { createRoute, Outlet } from '@tanstack/react-router'
import { act, cleanup, configure, fireEvent, screen, waitFor } from '@testing-library/react'
import { useState } from 'react'
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

// A specifier Vite does not resolve ahead, so the file loads before the web task creates the
// module; turn it into a static import when the it.fails marks go.
const MODULE = './reload-on-navigation'
const load = () => import(/* @vite-ignore */ MODULE)

configure({ asyncUtilTimeout: 5000 })

beforeAll(async () => {
  await initI18n(['es-ES'])
})

afterEach(cleanup)

// Made-up hashes and dates (ADR-0043).
const OWN = 'a1b2c3d4e5f6'
const A = '9f8e7d6c5b4a'
const B = '0a1b2c3d4e5f'
const BUILD = '2026-01-01T00:00:00Z'
const LATER = '2100-01-01T00:00:00Z'
const AFTER_NOTICE = 31 * 60_000

// The save bar of a future screen: it holds the new version while there are unsaved changes.
let useHoldNewVersion: (active: boolean) => void = () => {
  throw new Error('load the module first')
}
function TestSaveBar() {
  const [isDirty, setIsDirty] = useState(true)
  useHoldNewVersion(isDirty)

  return (
    <>
      {isDirty && (
        <button type="button" onClick={() => setIsDirty(false)}>
          Guardar
        </button>
      )}
      <Outlet />
    </>
  )
}

// Test-only screens that each ask the API on every visit, so its answers carry the served
// version. addChildren replaces the root's children in place, so renderApp's routeTree gets them.
const asksTheApi = {
  loader: async ({ context }: { context: RouterContext }) => {
    await context.apiClient.api.me.$get()
  },
}
const holdRoute = createRoute({
  getParentRoute: () => rootRoute,
  path: '/hold',
  component: TestSaveBar,
  ...asksTheApi,
})
rootRoute.addChildren([
  ...(rootRoute.children as never[]),
  createRoute({ getParentRoute: () => rootRoute, path: '/v/$n', ...asksTheApi }),
  holdRoute.addChildren([
    createRoute({ getParentRoute: () => holdRoute, path: '$n', ...asksTheApi }),
  ]),
])

const signedOut = () => problem({ status: 401, code: 'access.unauthenticated' })

// One page load of the app at `path`; `served` gives the version headers of each answer.
function visit({
  path,
  served,
  storage = memoryStorage(),
}: {
  path: string
  served: () => Record<string, string>
  storage?: ReturnType<typeof memoryStorage>
}) {
  const recorded = recordingLocation()
  const { timers, advance } = manualTimers()
  const answered = { count: 0 }
  const { router } = renderApp({
    path,
    answer: servedVersion(() => {
      answered.count++
      return signedOut()
    }, served),
    version: OWN,
    buildDate: BUILD,
    storage,
    location: recorded.location,
    timers,
  })
  const settled = async () => {
    await waitFor(() => expect(answered.count).toBeGreaterThan(0))
    await waitFor(() => expect(router.state.status).toBe('idle'))
  }
  const navigate = async (to: string) => {
    await act(async () => {
      router.history.push(to)
    })
    await waitFor(() => expect(router.state.status).toBe('idle'))
  }
  const reloadsOf = () => recorded.assigned.length + recorded.reloads.count

  return { router, ...recorded, advance, settled, navigate, reloadsOf }
}

const pathOf = (url: string) => new URL(url, window.location.origin)

describe('reloadOnNavigation', () => {
  it.fails('E1 with a new version, the next navigation reloads at its destination', async () => {
    await load()
    const app = visit({ path: '/v/0', served: () => ({ 'X-App-Version': A }) })
    await app.settled()

    await app.navigate('/v/1')

    expect(app.assigned).toHaveLength(1)
    const target = pathOf(app.assigned[0] ?? '')
    expect(target.origin).toBe(window.location.origin)
    expect(target.pathname).toBe('/v/1')
    expect(app.reloads.count).toBe(0)
    expect(app.router.state.location.pathname).toBe('/v/0')
  })

  it.fails('E2 with the same version, or no version header, a navigation stays in the app', async () => {
    const { reloadOnNavigation } = await load()
    expect(reloadOnNavigation).toBeTypeOf('function')

    for (const served of [{ 'X-App-Version': OWN }, {}]) {
      const app = visit({ path: '/v/0', served: () => served })
      await app.settled()

      await app.navigate('/v/1')

      expect(app.router.state.location.pathname).toBe('/v/1')
      expect(app.reloadsOf()).toBe(0)
      cleanup()
    }
  })

  it.fails('E1 a back and a replace navigation reload too', async () => {
    await load()
    let served = OWN
    const back = visit({ path: '/v/0', served: () => ({ 'X-App-Version': served }) })
    await back.settled()
    served = A
    await back.navigate('/v/1')

    await act(async () => {
      back.router.history.back()
    })

    await waitFor(() => expect(back.assigned.map((url) => pathOf(url).pathname)).toEqual(['/v/0']))
    cleanup()
    const replace = visit({ path: '/v/0', served: () => ({ 'X-App-Version': A }) })
    await replace.settled()

    await act(async () => {
      replace.router.history.replace('/v/2')
    })

    await waitFor(() =>
      expect(replace.assigned.map((url) => pathOf(url).pathname)).toEqual(['/v/2']),
    )
  })

  it.fails('a change of the query alone never reloads', async () => {
    await load()
    const app = visit({ path: '/v/1', served: () => ({ 'X-App-Version': A }) })
    await app.settled()

    await app.navigate('/v/1?page=2')

    expect(app.router.state.location.search).toEqual({ page: 2 })
    expect(app.reloadsOf()).toBe(0)
    await app.navigate('/v/2')
    expect(app.assigned).toHaveLength(1)
  })

  it.fails('E3 no reload and no notice while the save bar holds; the first navigation after it is gone reloads', async () => {
    const module = await load()
    useHoldNewVersion = module.useHoldNewVersion
    const app = visit({ path: '/hold/a', served: () => ({ 'X-App-Version': A }) })
    await app.settled()

    await app.navigate('/hold/b')
    app.advance(AFTER_NOTICE)

    expect(app.router.state.location.pathname).toBe('/hold/b')
    expect(app.reloadsOf()).toBe(0)
    expect(screen.queryByText('Hay una versión nueva')).toBeNull()

    fireEvent.click(screen.getByRole('button', { name: 'Guardar' }))
    await app.navigate('/hold/c')

    expect(app.assigned.map((url) => pathOf(url).pathname)).toEqual(['/hold/c'])
  })

  it.fails('E3 E6 the minimum-version dialog shows even while the save bar holds', async () => {
    const module = await load()
    useHoldNewVersion = module.useHoldNewVersion
    const app = visit({
      path: '/hold/a',
      served: () => ({ 'X-App-Version': A, 'X-Min-Client-Version': LATER }),
    })
    await app.settled()

    expect(await screen.findByRole('alertdialog', { name: 'Recarga para continuar' })).toBeTruthy()
    expect(app.reloadsOf()).toBe(0)
  })

  it.fails('R3 two versions served in turn (A, B, A, B) reload once per version, and never by themselves', async () => {
    await load()
    const storage = memoryStorage()
    let served = A
    const pageLoad = (path: string) =>
      visit({ path, storage, served: () => ({ 'X-App-Version': served }) })
    let reloads = 0

    // Every reload is a new page load with the same old bundle and the same sessionStorage.
    const first = pageLoad('/v/0')
    await first.settled()
    first.advance(AFTER_NOTICE)
    expect(first.reloadsOf()).toBe(0)
    await first.navigate('/v/1')
    reloads += first.reloadsOf()
    cleanup()

    served = B
    const second = pageLoad('/v/1')
    await second.settled()
    await second.navigate('/v/2')
    reloads += second.reloadsOf()
    cleanup()

    served = A
    const third = pageLoad('/v/2')
    await third.settled()
    served = B
    await third.navigate('/v/3')
    await third.navigate('/v/4')
    third.advance(AFTER_NOTICE)
    reloads += third.reloadsOf()

    expect(reloads).toBe(2)
    expect(third.router.state.location.pathname).toBe('/v/4')
  })

  it.fails('R3 R4 a storage that throws never reloads', async () => {
    await load()
    const app = visit({
      path: '/v/0',
      served: () => ({ 'X-App-Version': A }),
      storage: memoryStorage({ failing: true }),
    })
    await app.settled()

    await app.navigate('/v/1')

    expect(app.reloadsOf()).toBe(0)
    expect(app.router.state.location.pathname).toBe('/v/1')
    // Asserted apart: a module that never reloads would pass the lines above.
    cleanup()
    const working = visit({ path: '/v/0', served: () => ({ 'X-App-Version': A }) })
    await working.settled()
    await working.navigate('/v/1')
    expect(working.assigned).toHaveLength(1)
  })

  it.fails('R2 a served version that is a URL is not a new version', async () => {
    await load()
    const app = visit({ path: '/v/0', served: () => ({ 'X-App-Version': '//evil.example' }) })
    await app.settled()

    await app.navigate('/v/1')

    expect(app.reloadsOf()).toBe(0)
    expect(app.router.state.location.pathname).toBe('/v/1')
    // Asserted apart: a module that never reloads would pass the lines above.
    cleanup()
    const valid = visit({ path: '/v/0', served: () => ({ 'X-App-Version': A }) })
    await valid.settled()
    await valid.navigate('/v/1')
    expect(valid.assigned).toHaveLength(1)
  })

  it.fails('R5 the reload stays on our origin, whatever returnTo or the destination say', async () => {
    await load()
    const app = visit({
      path: '/v/0?returnTo=https://evil.example',
      served: () => ({ 'X-App-Version': A }),
    })
    await app.settled()

    await app.navigate('//evil.example/x')

    expect(app.reloadsOf()).toBe(1)
    for (const url of app.assigned) {
      expect(pathOf(url).origin).toBe(window.location.origin)
      expect(url).not.toContain('evil.example')
    }
  })
})
