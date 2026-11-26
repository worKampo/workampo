import { render, screen } from '@testing-library/react'
import type { ReactNode } from 'react'
import { describe, expect, it } from 'vitest'

// A specifier Vite does not resolve ahead, so the file loads before T4 creates the module; turn it
// into a static import when the it.fails marks go.
const MODULE = './system-page'
const load = () => import(/* @vite-ignore */ MODULE)

// docs/design/components.md, "System page".
async function renderNotFound(reference?: ReactNode) {
  const { SystemPage } = await load()
  render(
    <SystemPage
      title="Página no encontrada"
      body="La dirección puede estar mal escrita o la página se ha movido."
      code="Error 404"
      reference={reference}
      actions={<a href="/">Ir al inicio</a>}
    />,
  )

  return {
    heading: screen.getByRole('heading', { level: 1, name: 'Página no encontrada' }),
    main: screen.getByRole('main'),
  }
}

describe('SystemPage', () => {
  it.fails('E1 the card has the title, the text, the code as a meta line and the action', async () => {
    const { main } = await renderNotFound()

    expect(main.textContent).toContain(
      'La dirección puede estar mal escrita o la página se ha movido.',
    )
    expect(screen.getByText('Error 404')).toBeTruthy()
    expect(screen.getByRole('link', { name: 'Ir al inicio' }).getAttribute('href')).toBe('/')
    expect(screen.getAllByRole('heading', { level: 1 })).toHaveLength(1)
  })

  it.fails('E1 decision 7: the colour logo is in the header and there is no logo inside the card', async () => {
    const { main } = await renderNotFound()

    expect(screen.getByRole('banner').textContent).toContain('worKampo')
    expect(main.querySelector('svg')).toBeNull()
  })

  it.fails('the title takes the focus on mount, by code only', async () => {
    const { heading } = await renderNotFound()

    expect(heading.tabIndex).toBe(-1)
    expect(document.activeElement).toBe(heading)
  })

  it.fails('E2 the reference goes under the meta line, before the actions', async () => {
    await renderNotFound(<span>Referencia: 7F3K-92QD</span>)

    const code = screen.getByText('Error 404')
    const reference = screen.getByText('Referencia: 7F3K-92QD')
    const action = screen.getByRole('link', { name: 'Ir al inicio' })
    expect(code.compareDocumentPosition(reference) & Node.DOCUMENT_POSITION_FOLLOWING).toBeTruthy()
    expect(
      reference.compareDocumentPosition(action) & Node.DOCUMENT_POSITION_FOLLOWING,
    ).toBeTruthy()
  })

  it.fails('E3 the page fills the screen on the chrome background and stacks the actions', async () => {
    const { main } = await renderNotFound()

    const page = main.parentElement
    expect(page?.className).toMatch(/min-h-screen/)
    expect(page?.className).toMatch(/bg-chrome/)
    expect(screen.getByRole('link', { name: 'Ir al inicio' }).parentElement?.className).toMatch(
      /flex-col/,
    )
  })

  it.fails('shows no reference line without a reference', async () => {
    const { main } = await renderNotFound()

    expect(main.textContent).not.toContain('Referencia')
  })
})
