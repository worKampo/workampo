import { describe, expect, it } from 'vitest'
import { fallbackLng, initI18n } from './i18n'

describe('initI18n', () => {
  it('@id:access-96-17 uses the browser language and sets it on the page', async () => {
    const i18n = await initI18n(['es-ES', 'en'])

    expect(i18n.language).toBe('es')
    expect(document.documentElement.lang).toBe('es')
    expect(i18n.t('access:errors.invalid_code')).toBe(
      'El código no es válido o ha caducado. Puedes pedir otro.',
    )
  })

  it('falls back from Catalan to Spanish before English', () => {
    expect(fallbackLng).toEqual({ ca: ['es', 'en'], es: ['en'], default: ['en'] })
  })
})
