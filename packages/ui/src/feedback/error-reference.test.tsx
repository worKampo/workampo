import { act, fireEvent, render, screen, waitFor } from '@testing-library/react'
import { afterEach, describe, expect, it, vi } from 'vitest'
import { ErrorReference } from './error-reference'

// A made-up reference (ADR-0043).
const REFERENCE = '7F3K-92QD'
const LABELS = {
  line: `Referencia: ${REFERENCE}`,
  copy: 'Copiar la referencia',
  copied: 'Copiada',
  copiedStatus: 'Referencia copiada',
  copyFailed: 'No se ha podido copiar. Selecciona la referencia y cópiala.',
}

function stubClipboard(writeText: ((text: string) => Promise<void>) | undefined) {
  Object.defineProperty(navigator, 'clipboard', {
    configurable: true,
    value: writeText ? { writeText } : undefined,
  })
}

afterEach(() => {
  stubClipboard(undefined)
  window.getSelection()?.removeAllRanges()
})

async function renderReference() {
  render(<ErrorReference reference={REFERENCE} labels={LABELS} />)

  return screen.getByRole('button', { name: 'Copiar la referencia' })
}

async function copy(button: HTMLElement) {
  button.focus()
  await act(async () => {
    fireEvent.click(button)
  })
}

describe('ErrorReference', () => {
  it('shows the line with the reference in a code that is never translated and selects whole', async () => {
    await renderReference()

    const code = screen.getByText(REFERENCE)
    expect(code.tagName).toBe('CODE')
    expect(code.getAttribute('dir')).toBe('ltr')
    expect(code.getAttribute('translate')).toBe('no')
    expect(code.className).toMatch(/select-all/)
    expect(code.className).toMatch(/break-all/)
    expect(code.parentElement?.textContent).toContain(LABELS.line)
  })

  it('decision 8: the copy button is subtle and icon-only, named like its tooltip', async () => {
    const button = await renderReference()

    expect(button.textContent).toBe('')
    expect(button.querySelector('svg')?.getAttribute('aria-hidden')).toBe('true')
    expect(button.className).toMatch(/border-transparent/)
    expect(button.className).toMatch(/pointer-coarse:/)
    fireEvent.focus(button)
    expect((await screen.findByRole('tooltip')).textContent).toBe('Copiar la referencia')
  })

  it('E1 copying writes the reference, announces it and keeps the focus on the button', async () => {
    const writeText = vi.fn(async (_text: string) => {})
    stubClipboard(writeText)
    const button = await renderReference()

    await copy(button)

    expect(writeText).toHaveBeenCalledWith(REFERENCE)
    const status = (await screen.findByText('Referencia copiada')).closest('[role="status"]')
    expect(status).not.toBeNull()
    expect(document.activeElement).toBe(button)
    expect(button.querySelector('svg')?.getAttribute('class')).toMatch(/text-pos/)
    expect(screen.queryByRole('alert')).toBeNull()
  })

  it('E1 the tooltip says «Copiada» after copying, and the copy icon is back after 2 s', async () => {
    stubClipboard(async () => {})
    const button = await renderReference()

    await copy(button)
    fireEvent.focus(button)

    await waitFor(() => expect(screen.getByRole('tooltip').textContent).toBe('Copiada'))
    await waitFor(
      () => expect(button.querySelector('svg')?.getAttribute('class')).not.toMatch(/text-pos/),
      {
        timeout: 3000,
      },
    )
  })

  it('E1 F1 the tooltip stays open with «Copiada» after the click, without a new focus', async () => {
    stubClipboard(async () => {})
    const button = await renderReference()
    fireEvent.focus(button)
    await screen.findByRole('tooltip')

    await copy(button)

    await waitFor(() => expect(screen.getByRole('tooltip').textContent).toBe('Copiada'))
  })

  it('shows the reference after the line when a translation lacks it', () => {
    render(<ErrorReference reference={REFERENCE} labels={{ ...LABELS, line: 'Referencia:' }} />)

    expect(screen.getByText(REFERENCE).parentElement?.textContent).toBe(`Referencia: ${REFERENCE}`)
  })

  it('E2 a failed copy selects the reference and says so in an alert, with the focus kept', async () => {
    stubClipboard(async () => {
      throw new Error('denied')
    })
    const button = await renderReference()

    await copy(button)

    expect((await screen.findByRole('alert')).textContent).toBe(LABELS.copyFailed)
    expect(window.getSelection()?.toString()).toBe(REFERENCE)
    expect(document.activeElement).toBe(button)
    expect(screen.queryByText('Referencia copiada')).toBeNull()
  })

  it('E2 without a clipboard the copy fails the same way', async () => {
    const button = await renderReference()

    await copy(button)

    expect((await screen.findByRole('alert')).textContent).toBe(LABELS.copyFailed)
    expect(window.getSelection()?.toString()).toBe(REFERENCE)
  })
})
