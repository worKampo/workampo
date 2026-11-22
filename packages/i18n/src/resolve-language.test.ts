import { describe, expect, it } from 'vitest'
import { fallbackLanguages, resolveLanguage } from './resolve-language'

describe('@id:access-96-17 resolveLanguage', () => {
  it('a browser that asks for Spanish gets Spanish', () => {
    expect(resolveLanguage(['es-ES', 'en'])).toBe('es')
    expect(resolveLanguage(['es'])).toBe('es')
  })

  it('a browser that asks for Catalan gets Catalan', () => {
    expect(resolveLanguage(['ca'])).toBe('ca')
    expect(resolveLanguage(['ca-ES'])).toBe('ca')
  })

  it('takes the first supported language of the list', () => {
    expect(resolveLanguage(['fr-FR', 'ca', 'es'])).toBe('ca')
    expect(resolveLanguage(['de', 'en-GB', 'es'])).toBe('en')
  })

  it('falls back to English', () => {
    expect(resolveLanguage(['fr', 'de'])).toBe('en')
    expect(resolveLanguage([])).toBe('en')
    expect(resolveLanguage('')).toBe('en')
    expect(resolveLanguage(undefined)).toBe('en')
  })

  it('reads an Accept-Language header by its weights', () => {
    expect(resolveLanguage('fr-FR,fr;q=0.9,es;q=0.8,en;q=0.7')).toBe('es')
    expect(resolveLanguage('en;q=0.5, ca-ES')).toBe('ca')
    expect(resolveLanguage('*')).toBe('en')
  })
})

describe('fallbackLanguages', () => {
  it('Catalan falls back to Spanish before English', () => {
    expect(fallbackLanguages('ca')).toEqual(['es', 'en'])
  })

  it('Spanish falls back to English and English to nothing', () => {
    expect(fallbackLanguages('es')).toEqual(['en'])
    expect(fallbackLanguages('en')).toEqual([])
  })
})
