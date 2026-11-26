import { cleanup, renderHook } from '@testing-library/react'
import type { ReactNode } from 'react'
import { afterEach, expect, it } from 'vitest'

// A specifier Vite does not resolve ahead, so the file loads before T6 creates the module; turn it
// into a static import when the it.fails marks go.
const MODULE = './document-title'
const load = () => import(/* @vite-ignore */ MODULE)

afterEach(cleanup)

it.fails('@id:companies-92-10 inside a company the title names the page, the company and the app', async () => {
  const { DocumentTitleProvider, useDocumentTitle } = await load()
  const wrapper = ({ children }: { children: ReactNode }) => (
    <DocumentTitleProvider company="Northwind Logistics">{children}</DocumentTitleProvider>
  )

  renderHook(() => useDocumentTitle('Inicio'), { wrapper })

  expect(document.title).toBe('Inicio · Northwind Logistics · worKampo')
})

it.fails('@id:companies-92-10 outside a company the title names the page and the app', async () => {
  const { useDocumentTitle } = await load()

  renderHook(() => useDocumentTitle('Elige una empresa'))

  expect(document.title).toBe('Elige una empresa · worKampo')
})

it.fails('@id:companies-92-10 the title follows the page', async () => {
  const { useDocumentTitle } = await load()
  const { rerender } = renderHook(({ page }) => useDocumentTitle(page), {
    initialProps: { page: 'Inicio' },
  })

  rerender({ page: 'No encontramos esta página' })

  expect(document.title).toBe('No encontramos esta página · worKampo')
})
