import { describe, expect, it } from 'vitest'

// A specifier Vite does not resolve ahead, so the file loads before the module exists; turn it
// into a static import when the it.fails marks go.
const MODULE = './client-version'
const load = () => import(/* @vite-ignore */ MODULE)

// Made-up hashes and dates (ADR-0043).
const OWN = 'a1b2c3d4e5f6'
const NEW = '9f8e7d6c5b4a'
const BUILD = '2026-01-01T00:00:00Z'

describe('isClientVersion', () => {
  it.fails('R1 accepts a build hash or a version of up to 64 safe characters', async () => {
    const { isClientVersion } = await load()

    for (const version of [OWN, 'v1.2.3-rc_1', 'a'.repeat(64)])
      expect(isClientVersion(version), version).toBe(true)
  })

  it.fails('R1 R2 refuses free text, a URL, a newline, an empty value and 65 characters', async () => {
    const { isClientVersion } = await load()

    for (const version of [
      '',
      'a b',
      'v1"}',
      'x'.repeat(65),
      'a\nb',
      'https://evil.example',
      '//evil.example',
      null,
      undefined,
    ])
      expect(isClientVersion(version), String(version)).toBe(false)
  })
})

describe('isBuildDate', () => {
  it.fails('R7 accepts a UTC instant without milliseconds', async () => {
    const { isBuildDate } = await load()

    expect(isBuildDate('2026-11-27T10:15:00Z')).toBe(true)
  })

  it.fails('R7 refuses what is not a real UTC instant in that exact form', async () => {
    const { isBuildDate } = await load()

    for (const date of [
      '2026-13-40T00:00:00Z',
      '2026-02-30T00:00:00Z',
      'tomorrow',
      '',
      '<b>',
      '2026-11-27T10:15:00+01:00',
      '2026-11-27T10:15:00.000Z',
      '2026-11-27',
      null,
      undefined,
    ])
      expect(isBuildDate(date), String(date)).toBe(false)
  })
})

describe('newVersionServed', () => {
  it.fails('E1 a valid served version that differs from mine is the new one', async () => {
    const { newVersionServed } = await load()

    expect(newVersionServed(OWN, NEW)).toBe(NEW)
  })

  it.fails('E2 the same version is not new', async () => {
    const { newVersionServed } = await load()

    expect(newVersionServed(OWN, OWN)).toBeUndefined()
  })

  it.fails('R2 a missing, empty, too long or URL-shaped served version is never new', async () => {
    const { newVersionServed } = await load()

    for (const served of ['https://evil.example', '//evil.example', '', 'x'.repeat(65), null])
      expect(newVersionServed(OWN, served), String(served)).toBeUndefined()
    // Asserted apart: with a broken module every call is undefined, and this must still fail.
    expect(newVersionServed(OWN, NEW)).toBe(NEW)
  })

  it.fails('R2 a dev build never has a new version', async () => {
    const { newVersionServed } = await load()

    expect(newVersionServed('dev', NEW)).toBeUndefined()
    expect(newVersionServed(OWN, NEW)).toBe(NEW)
  })
})

describe('isBelowMinimum', () => {
  it.fails('E6 a minimum later than my build date puts me below it', async () => {
    const { isBelowMinimum } = await load()

    expect(isBelowMinimum(BUILD, '2026-01-01T00:00:01Z')).toBe(true)
    expect(isBelowMinimum(BUILD, '2100-01-01T00:00:00Z')).toBe(true)
  })

  it.fails('R7 an equal or earlier minimum does not', async () => {
    const { isBelowMinimum } = await load()

    expect(isBelowMinimum(BUILD, BUILD)).toBe(false)
    expect(isBelowMinimum(BUILD, '2025-12-31T23:59:59Z')).toBe(false)
    expect(isBelowMinimum(BUILD, '2100-01-01T00:00:00Z')).toBe(true)
  })

  it.fails('R7 an invalid minimum or build date is never below anything', async () => {
    const { isBelowMinimum } = await load()

    for (const minimum of [
      '2026-13-40T00:00:00Z',
      'tomorrow',
      '',
      '<b>',
      '2100-01-01T00:00:00+01:00',
      '2100-01-01T00:00:00.000Z',
      null,
    ])
      expect(isBelowMinimum(BUILD, minimum), String(minimum)).toBe(false)
    for (const own of ['dev', '', 'tomorrow'])
      expect(isBelowMinimum(own, '2100-01-01T00:00:00Z'), own).toBe(false)
    expect(isBelowMinimum(BUILD, '2100-01-01T00:00:00Z')).toBe(true)
  })
})
