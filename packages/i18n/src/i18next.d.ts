import type { resources } from './index'

// Typed keys: t('access:errors.invalid_code') is checked against the English texts.
declare module 'i18next' {
  interface CustomTypeOptions {
    defaultNS: 'access'
    resources: (typeof resources)['en']
  }
}
