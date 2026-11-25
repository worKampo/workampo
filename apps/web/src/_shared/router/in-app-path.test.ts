import { describe, expect, it } from 'vitest'

// in-app-path.ts arrives with the web shared pieces task; a non-literal path keeps typecheck green
// until then. Once it exists, import it statically.
const IN_APP_PATH: string = './in-app-path'
type InAppPath = (url: string) => string | undefined
const load = async (): Promise<InAppPath> => {
  const module: { inAppPath: InAppPath } = await import(IN_APP_PATH)
  return module.inAppPath
}

describe('inAppPath', () => {
  it.fails('@id:companies-91-4 a company URL on our own origin stays in the app as its path', async () => {
    const inAppPath = await load()
    const { origin } = window.location

    expect(inAppPath(`${origin}/c/sol-bakery/`)).toBe('/c/sol-bakery/')
    expect(inAppPath(`${origin}/c/northwind`)).toBe('/c/northwind')
  })

  it.fails('@id:companies-91-4 a URL on another host, a subdomain or another scheme leaves the app', async () => {
    const inAppPath = await load()
    const { host, protocol } = window.location
    const otherScheme = protocol === 'https:' ? 'http:' : 'https:'

    expect(inAppPath('https://otro-sitio.example.com/c/sol-bakery/')).toBeUndefined()
    expect(inAppPath(`${protocol}//sol-bakery.${host}/`)).toBeUndefined()
    expect(inAppPath(`${otherScheme}//${host}/c/sol-bakery/`)).toBeUndefined()
  })

  it.fails('@id:companies-91-4 a javascript: URL leaves the app, never runs in it', async () => {
    const inAppPath = await load()

    expect(inAppPath('javascript:alert(1)')).toBeUndefined()
  })
})
