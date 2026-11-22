import { expect, it } from 'vitest'
import { loadNamespace } from './load-namespace'

it('loads one namespace of one language', async () => {
  const texts = await loadNamespace({ language: 'ca', namespace: 'common' })

  expect(texts).toMatchObject({ states: { loading: "S'està carregant" } })
})

it('fails for a namespace that does not exist', async () => {
  const missing = loadNamespace({ language: 'en', namespace: 'nothing' })

  await expect(missing).rejects.toThrow()
})
