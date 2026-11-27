import { describe, expect, it, vi } from 'vitest'
import { manualTimers } from '../testing/render-app'
import { createVersionWatch } from './version-watch'

// Made-up hashes and dates (ADR-0043).
const OWN = 'a1b2c3d4e5f6'
const NEW = '9f8e7d6c5b4a'
const NEWER = '0a1b2c3d4e5f'
const BUILD = '2026-01-01T00:00:00Z'
const MINUTE = 60_000
const NOTICE_AFTER = 30 * MINUTE

const served = (headers: Record<string, string>) => new Headers(headers)

async function watch(ownVersion = OWN) {
  const clock = manualTimers()

  return {
    ...clock,
    watch: createVersionWatch({ ownVersion, ownBuildDate: BUILD, timers: clock.timers }),
  }
}

describe('createVersionWatch', () => {
  it('E1 a different served version is pending; the same one or no header is not', async () => {
    const { watch: versions } = await watch()

    versions.observe(served({ 'X-App-Version': OWN }))
    expect(versions.getSnapshot().pending).toBeUndefined()
    versions.observe(served({ 'X-App-Version': NEW }))
    expect(versions.getSnapshot().pending).toBe(NEW)
    versions.observe(served({}))
    expect(versions.getSnapshot().pending).toBe(NEW)
  })

  it('R2 a malformed served version and a dev build are never pending', async () => {
    const { watch: versions } = await watch()
    const { watch: dev } = await watch('dev')

    for (const value of ['https://evil.example', '//evil.example', '', 'x'.repeat(65)]) {
      versions.observe(served({ 'X-App-Version': value }))
      expect(versions.getSnapshot().pending, value).toBeUndefined()
    }
    dev.observe(served({ 'X-App-Version': NEW }))
    expect(dev.getSnapshot().pending).toBeUndefined()
  })

  it('E5 the notice is due 30 minutes after the new version is detected, not before', async () => {
    const { watch: versions, advance } = await watch()

    versions.observe(served({ 'X-App-Version': NEW }))
    advance(NOTICE_AFTER - 1000)
    expect(versions.getSnapshot().noticeDue).toBe(false)
    advance(1000)

    expect(versions.getSnapshot().noticeDue).toBe(true)
  })

  it('E5 the timer stops when the version is no longer new, and starts again on a new hash', async () => {
    const { watch: versions, advance } = await watch()

    versions.observe(served({ 'X-App-Version': NEW }))
    advance(20 * MINUTE)
    versions.observe(served({ 'X-App-Version': OWN }))
    advance(20 * MINUTE)
    expect(versions.getSnapshot()).toMatchObject({ pending: undefined, noticeDue: false })

    versions.observe(served({ 'X-App-Version': NEWER }))
    advance(NOTICE_AFTER - 1000)
    expect(versions.getSnapshot()).toMatchObject({ pending: NEWER, noticeDue: false })
    advance(1000)
    expect(versions.getSnapshot()).toMatchObject({ pending: NEWER, noticeDue: true })
  })

  it('E3 a holder holds until it releases, and two holders until both do', async () => {
    const { watch: versions } = await watch()

    const releaseBar = versions.hold()
    const releaseOther = versions.hold()
    expect(versions.getSnapshot().held).toBe(true)
    releaseBar()
    expect(versions.getSnapshot().held).toBe(true)
    releaseOther()

    expect(versions.getSnapshot().held).toBe(false)
  })

  it('E6 a minimum later than my build makes me outdated, and it sticks', async () => {
    const { watch: versions } = await watch()

    versions.observe(served({ 'X-Min-Client-Version': '2100-01-01T00:00:00Z' }))
    expect(versions.getSnapshot().outdated).toBe(true)
    versions.observe(served({}))
    versions.observe(served({ 'X-Min-Client-Version': '2025-01-01T00:00:00Z' }))

    expect(versions.getSnapshot().outdated).toBe(true)
  })

  it('R7 an invalid, equal or earlier minimum does not make me outdated', async () => {
    const { watch: versions } = await watch()

    for (const minimum of [
      '2026-13-40T00:00:00Z',
      'tomorrow',
      '',
      '<b>',
      BUILD,
      '2025-01-01T00:00:00Z',
    ])
      versions.observe(served({ 'X-Min-Client-Version': minimum }))
    expect(versions.getSnapshot().outdated).toBe(false)
    versions.observe(served({ 'X-Min-Client-Version': '2100-01-01T00:00:00Z' }))
    expect(versions.getSnapshot().outdated).toBe(true)
  })

  it('a subscriber hears every change, and stops hearing once it unsubscribes', async () => {
    const { watch: versions, advance } = await watch()
    const listener = vi.fn()

    const unsubscribe = versions.subscribe(listener)
    versions.observe(served({ 'X-App-Version': NEW }))
    advance(NOTICE_AFTER)
    const heard = listener.mock.calls.length
    unsubscribe()
    versions.observe(served({ 'X-App-Version': OWN }))

    expect(heard).toBeGreaterThanOrEqual(2)
    expect(listener).toHaveBeenCalledTimes(heard)
  })
})
