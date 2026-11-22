import { LANGUAGES } from '@workampo/i18n'
import { loadNamespace } from '@workampo/i18n/load-namespace'
import { FALLBACKS, resolveLanguage } from '@workampo/i18n/resolve-language'
import i18next, { type BackendModule } from 'i18next'
import { initReactI18next } from 'react-i18next'

// Catalan falls back to Spanish before English, the same chain the API uses (ADR-0047).
export const fallbackLng = {
  ...Object.fromEntries(Object.entries(FALLBACKS).filter(([, chain]) => chain.length > 0)),
  default: ['en'],
}

// Only the active language's chain and the namespaces in use are fetched (ADR-0073 point 4).
const onDemand: BackendModule = {
  type: 'backend',
  init() {},
  // biome-ignore lint/complexity/useMaxParams: the signature is i18next's backend contract.
  read(language, namespace, callback) {
    loadNamespace({ language, namespace }).then(
      (texts) => callback(null, texts),
      (error: Error) => callback(error, false),
    )
  },
}

// No detector plugin: our own order of ADR-0047 picks the language.
export async function initI18n(preferences: readonly string[]) {
  const lng = resolveLanguage(preferences)

  await i18next
    .use(onDemand)
    .use(initReactI18next)
    .init({
      lng,
      fallbackLng,
      supportedLngs: [...LANGUAGES],
      ns: ['common'],
      defaultNS: 'access',
      interpolation: { escapeValue: false },
    })
  document.documentElement.lang = lng

  return i18next
}
