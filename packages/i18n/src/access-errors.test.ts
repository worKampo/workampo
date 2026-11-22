import { ACCESS_ERROR_CODES } from '@workampo/domain/access/errors'
import { expect, it } from 'vitest'
import { LANGUAGES, resources } from './index'

it('every access error code has its text in every language', () => {
  for (const language of LANGUAGES)
    for (const code of ACCESS_ERROR_CODES) {
      const reason = code.replace(
        /^access\./,
        '',
      ) as keyof (typeof resources)['en']['access']['errors']
      expect(resources[language].access.errors[reason], `${language} ${code}`).toBeTruthy()
    }
})
