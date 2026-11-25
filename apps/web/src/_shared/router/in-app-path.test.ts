import { describe, expect, it } from 'vitest'
import { inAppPath } from './in-app-path'

describe('inAppPath', () => {
  it('@id:companies-91-4 a company URL on our own origin stays in the app as its path', () => {
    const { origin } = window.location

    expect(inAppPath(`${origin}/c/sol-bakery/`)).toBe('/c/sol-bakery/')
    expect(inAppPath(`${origin}/c/northwind`)).toBe('/c/northwind')
  })

  it('@id:companies-91-4 a URL on another host, a subdomain or another scheme leaves the app', () => {
    const { host, protocol } = window.location
    const otherScheme = protocol === 'https:' ? 'http:' : 'https:'

    expect(inAppPath('https://otro-sitio.example.com/c/sol-bakery/')).toBeUndefined()
    expect(inAppPath(`${protocol}//sol-bakery.${host}/`)).toBeUndefined()
    expect(inAppPath(`${otherScheme}//${host}/c/sol-bakery/`)).toBeUndefined()
  })

  it('@id:companies-91-4 a javascript: URL leaves the app, never runs in it', () => {
    expect(inAppPath('javascript:alert(1)')).toBeUndefined()
  })
})
