import caAccess from './locales/ca/access.json' with { type: 'json' }
import caCommon from './locales/ca/common.json' with { type: 'json' }
import caCompanies from './locales/ca/companies.json' with { type: 'json' }
import enAccess from './locales/en/access.json' with { type: 'json' }
import enCommon from './locales/en/common.json' with { type: 'json' }
import enCompanies from './locales/en/companies.json' with { type: 'json' }
import esAccess from './locales/es/access.json' with { type: 'json' }
import esCommon from './locales/es/common.json' with { type: 'json' }
import esCompanies from './locales/es/companies.json' with { type: 'json' }

export const LANGUAGES = ['en', 'es', 'ca'] as const
export type Language = (typeof LANGUAGES)[number]

// One i18next namespace per domain, plus common; keys inside follow screen.element.
// locales/_context/ is for translators only and never loaded.
export const resources = {
  en: { access: enAccess, common: enCommon, companies: enCompanies },
  es: { access: esAccess, common: esCommon, companies: esCompanies },
  ca: { access: caAccess, common: caCommon, companies: caCompanies },
} satisfies Record<Language, unknown>
