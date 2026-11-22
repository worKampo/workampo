import { ERROR_CODES } from '@workampo/domain/errors'
import { expect, it } from 'vitest'
import { LANGUAGES, resources } from './index'

it('every error code of every domain has its text in every language', () => {
  for (const language of LANGUAGES)
    for (const code of ERROR_CODES) {
      const [domain = '', reason = ''] = code.split('.')
      const texts = resources[language] as Record<string, { errors?: Record<string, string> }>

      expect(texts[domain]?.errors?.[reason], `${language} ${code}`).toBeTruthy()
    }
})
