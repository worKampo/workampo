import { createRoute } from '@tanstack/react-router'
import { cleanup, configure, screen, waitFor } from '@testing-library/react'
import { afterEach, beforeAll, describe, expect, it } from 'vitest'
import { initI18n } from '../i18n/i18n'
import { rootRoute } from '../router/root-route'
import { memoryStorage, problem, recordingLocation, renderApp } from '../testing/render-app'
import { reloadOnceAfterChunkError } from './chunk-reload'

configure({ asyncUtilTimeout: 5000 })

beforeAll(async () => {
  await initI18n(['es-ES'])
})

afterEach(cleanup)

// Made-up hashes (ADR-0043).
const OWN = 'a1b2c3d4e5f6'
const NEW = '9f8e7d6c5b4a'
const MARK = 'workampo:chunk-reload'
const FAILED = { level: 1, name: 'Algo ha ido mal' } as const

// What each browser says when a lazy chunk cannot load, and Vite when its CSS cannot.
const CHUNK_ERRORS = [
  new TypeError(
    'Failed to fetch dynamically imported module: https://app.test/assets/company-picker.page-a1b2c3d4.js',
  ),
  new TypeError(
    'error loading dynamically imported module: https://app.test/assets/company-picker.page-a1b2c3d4.js',
  ),
  new TypeError('Importing a module script failed.'),
  new Error('Unable to preload CSS for /assets/company-picker.page-a1b2c3d4.css'),
]

// A test-only screen whose code never loads. addChildren replaces the root's children in place, so
// renderApp's routeTree (the root itself) gets it too.
rootRoute.addChildren([
  ...(rootRoute.children as never[]),
  createRoute({ getParentRoute: () => rootRoute, path: '/broken-chunk' }).lazy(() =>
    Promise.reject(CHUNK_ERRORS[0]),
  ),
])

const signedOut = () => problem({ status: 401, code: 'access.unauthenticated' })

describe('reloadOnceAfterChunkError', () => {
  it('E4 R4 the first failed code load reloads and marks only my version', async () => {
    const storage = memoryStorage()
    const { location, reloads } = recordingLocation()

    const isReloading = reloadOnceAfterChunkError({
      error: CHUNK_ERRORS[0],
      ownVersion: OWN,
      storage,
      location,
    })

    expect(isReloading).toBe(true)
    expect(reloads.count).toBe(1)
    expect(storage.getItem(MARK)).toBe(OWN)
  })

  it('E4 R4 a second failure with the same version does not reload again', async () => {
    const storage = memoryStorage()
    const { location, reloads } = recordingLocation()
    const attempt = () =>
      reloadOnceAfterChunkError({ error: CHUNK_ERRORS[0], ownVersion: OWN, storage, location })

    const first = attempt()
    const second = attempt()

    expect([first, second]).toEqual([true, false])
    expect(reloads.count).toBe(1)
  })

  it('R4 a mark from another version reloads once more, into this one', async () => {
    const storage = memoryStorage()
    storage.setItem(MARK, NEW)
    const { location, reloads } = recordingLocation()

    const isReloading = reloadOnceAfterChunkError({
      error: CHUNK_ERRORS[0],
      ownVersion: OWN,
      storage,
      location,
    })

    expect(isReloading).toBe(true)
    expect(reloads.count).toBe(1)
    expect(storage.getItem(MARK)).toBe(OWN)
  })

  it('R4 a storage that throws never reloads', async () => {
    const { location, reloads } = recordingLocation()

    const isReloading = reloadOnceAfterChunkError({
      error: CHUNK_ERRORS[0],
      ownVersion: OWN,
      storage: memoryStorage({ failing: true }),
      location,
    })

    expect(isReloading).toBe(false)
    expect(reloads.count).toBe(0)
  })

  it('E4 the wording of Chromium, Firefox, Safari and Vite is a failed code load', async () => {
    for (const error of CHUNK_ERRORS) {
      const { location } = recordingLocation()
      const isReloading = reloadOnceAfterChunkError({
        error,
        ownVersion: OWN,
        storage: memoryStorage(),
        location,
      })

      expect(isReloading, error.message).toBe(true)
    }
  })

  it('any other error is not a failed code load', async () => {
    const { location, reloads } = recordingLocation()
    const storage = memoryStorage()

    for (const error of [
      new Error('internal-detail'),
      new TypeError('Failed to fetch'),
      'Failed to fetch dynamically imported module',
      undefined,
    ])
      expect(
        reloadOnceAfterChunkError({ error, ownVersion: OWN, storage, location }),
        String(error),
      ).toBe(false)
    expect(reloads.count).toBe(0)
    expect(storage.getItem(MARK)).toBeNull()
    // Asserted apart: with a broken module every call is false, and this must still fail.
    expect(
      reloadOnceAfterChunkError({ error: CHUNK_ERRORS[0], ownVersion: OWN, storage, location }),
    ).toBe(true)
  })
})

describe('a screen whose code fails to load', () => {
  it('E4 reloads once without showing anything, and the second time shows the 500 without a reference', async () => {
    const storage = memoryStorage()
    const first = recordingLocation()

    renderApp({
      path: '/broken-chunk',
      answer: signedOut,
      version: OWN,
      storage,
      location: first.location,
    })

    await waitFor(() => expect(first.reloads.count).toBe(1))
    expect(screen.queryByRole('heading', FAILED)).toBeNull()

    cleanup()
    const second = recordingLocation()
    renderApp({
      path: '/broken-chunk',
      answer: signedOut,
      version: OWN,
      storage,
      location: second.location,
    })

    await screen.findByRole('heading', FAILED)
    expect(second.reloads.count).toBe(0)
    expect(document.body.textContent).not.toContain('Referencia')
    expect(screen.queryByRole('button', { name: 'Copiar la referencia' })).toBeNull()
  })
})
