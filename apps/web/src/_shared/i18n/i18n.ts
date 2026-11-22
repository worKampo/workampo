import { LANGUAGES, resources } from '@workampo/i18n'
import { FALLBACKS, resolveLanguage } from '@workampo/i18n/resolve-language'
import i18next from 'i18next'
import { initReactI18next } from 'react-i18next'

// Catalan falls back to Spanish before English, the same chain the API uses (ADR-0047).
export const fallbackLng = {
  ...Object.fromEntries(Object.entries(FALLBACKS).filter(([, chain]) => chain.length > 0)),
  default: ['en'],
}

// No detector plugin: our own order of ADR-0047 picks the language.
export async function initI18n(preferences: readonly string[]) {
  const lng = resolveLanguage(preferences)

  await i18next.use(initReactI18next).init({
    resources,
    lng,
    fallbackLng,
    supportedLngs: [...LANGUAGES],
    ns: ['access', 'common'],
    defaultNS: 'access',
    interpolation: { escapeValue: false },
  })
  document.documentElement.lang = lng

  return i18next
}
