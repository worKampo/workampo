import { cleanup, renderHook } from '@testing-library/react'
import type { ReactNode } from 'react'
import { afterEach, expect, it } from 'vitest'
import { DocumentTitleProvider, useDocumentTitle } from './document-title'

afterEach(cleanup)

it('@id:companies-92-10 inside a company the title names the page, the company and the app', () => {
  const wrapper = ({ children }: { children: ReactNode }) => (
    <DocumentTitleProvider company="Northwind Logistics">{children}</DocumentTitleProvider>
  )

  renderHook(() => useDocumentTitle('Inicio'), { wrapper })

  expect(document.title).toBe('Inicio · Northwind Logistics · worKampo')
})

it('@id:companies-92-10 outside a company the title names the page and the app', () => {
  renderHook(() => useDocumentTitle('Elige una empresa'))

  expect(document.title).toBe('Elige una empresa · worKampo')
})

it('@id:companies-92-10 the title follows the page', () => {
  const { rerender } = renderHook(({ page }) => useDocumentTitle(page), {
    initialProps: { page: 'Inicio' },
  })

  rerender({ page: 'No encontramos esta página' })

  expect(document.title).toBe('No encontramos esta página · worKampo')
})
