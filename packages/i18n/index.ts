import caAccess from './locales/ca/access.json' with { type: 'json' }
import enAccess from './locales/en/access.json' with { type: 'json' }
import esAccess from './locales/es/access.json' with { type: 'json' }

export const LANGUAGES = ['en', 'es', 'ca'] as const
export type Language = (typeof LANGUAGES)[number]

// One i18next namespace per domain; keys inside follow screen.element.
export const resources = {
  en: { access: enAccess },
  es: { access: esAccess },
  ca: { access: caAccess },
} satisfies Record<Language, unknown>
