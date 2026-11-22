import { LANGUAGES, type Language } from './index'

const DEFAULT_LANGUAGE: Language = 'en'

// Where Catalan is missing Spanish is used, and English only when neither exists (ADR-0047).
export const FALLBACKS: Record<Language, readonly Language[]> = {
  en: [],
  es: ['en'],
  ca: ['es', 'en'],
}

export function fallbackLanguages(language: Language): readonly Language[] {
  return FALLBACKS[language]
}

// No user or company preference yet: the browser list or Accept-Language, then English (ADR-0047).
export function resolveLanguage(preferences: readonly string[] | string | undefined): Language {
  const tags = typeof preferences === 'string' ? byWeight(preferences) : (preferences ?? [])

  for (const tag of tags) {
    const primary = tag.trim().toLowerCase().split('-')[0] ?? ''
    if (isLanguage(primary)) return primary
  }

  return DEFAULT_LANGUAGE
}

function byWeight(acceptLanguage: string): string[] {
  return acceptLanguage
    .split(',')
    .map((part) => {
      const [tag = '', ...params] = part.split(';')
      const q = params.map((p) => p.trim()).find((p) => p.startsWith('q='))

      return { tag, weight: q ? Number(q.slice(2)) : 1 }
    })
    .filter(({ weight }) => weight > 0)
    .sort((a, b) => b.weight - a.weight)
    .map(({ tag }) => tag)
}

const isLanguage = (tag: string): tag is Language => (LANGUAGES as readonly string[]).includes(tag)
