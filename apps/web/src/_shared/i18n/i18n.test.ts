import { describe, expect, it } from 'vitest'
import { fallbackLng, initI18n } from './i18n'

describe('initI18n', () => {
  it('@id:access-96-17 uses the browser language and sets it on the page', async () => {
    const i18n = await initI18n(['es-ES', 'en'])

    await i18n.loadNamespaces('access')

    expect(i18n.language).toBe('es')
    expect(document.documentElement.lang).toBe('es')
    expect(i18n.t('access:errors.invalid_code')).toBe(
      'El código no es válido o ha caducado. Puedes pedir otro.',
    )
  })

  it('loads only common at start, and the chain of the active language', async () => {
    const i18n = await initI18n(['ca'])

    expect(i18n.hasResourceBundle('ca', 'common')).toBe(true)
    expect(i18n.hasResourceBundle('ca', 'access')).toBe(false)
    expect(i18n.hasResourceBundle('es', 'common')).toBe(true)
  })

  it('falls back from Catalan to Spanish before English', () => {
    expect(fallbackLng).toEqual({ ca: ['es', 'en'], es: ['en'], default: ['en'] })
  })
})
