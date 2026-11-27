import { fireEvent, render, screen, waitFor } from '@testing-library/react'
import { useState } from 'react'
import { describe, expect, it } from 'vitest'
import { Button } from '../actions/button'
import { AlertDialog } from './alert-dialog'

const TITLE = 'Reload to continue'
const DESCRIPTION = "There's a new version of worKampo and this one can no longer be used."

// Like the new-version prompt: one action that turns busy when pressed and never closes the dialog.
function ReloadAction() {
  const [isBusy, setIsBusy] = useState(false)
  return (
    <Button aria-busy={isBusy} onClick={() => setIsBusy(true)}>
      Reload
    </Button>
  )
}

async function renderDialog() {
  render(
    <>
      <button type="button">Behind</button>
      <AlertDialog open title={TITLE} description={DESCRIPTION} actions={<ReloadAction />} />
    </>,
  )

  return screen.findByRole('alertdialog')
}

describe('AlertDialog', () => {
  it('E6 is a modal alertdialog named by its title and described by its text', async () => {
    const dialog = await renderDialog()

    expect(dialog.getAttribute('aria-modal')).toBe('true')
    expect(screen.getByRole('alertdialog', { name: TITLE })).toBe(dialog)
    const describedBy = dialog.getAttribute('aria-describedby') ?? ''
    expect(document.getElementById(describedBy)?.textContent).toBe(DESCRIPTION)
  })

  // The page behind is inert through showModal, which jsdom lacks: new-version.e2e.ts E6 proves it.
  it('E6 the focus goes to the first action', async () => {
    const dialog = await renderDialog()

    const reload = screen.getByRole('button', { name: 'Reload' })
    await waitFor(() => expect(document.activeElement).toBe(reload))
    expect(dialog.contains(reload)).toBe(true)
  })

  it('E6 Esc, the scrim and a click outside leave it open', async () => {
    const dialog = await renderDialog()

    fireEvent.keyDown(dialog, { key: 'Escape' })
    fireEvent.pointerDown(document.body)
    fireEvent.click(document.body)

    expect(screen.getByRole('alertdialog')).toBe(dialog)
  })

  it('E6 it has no close button: its actions are its only buttons', async () => {
    const dialog = await renderDialog()

    const buttons = [...dialog.querySelectorAll('button')].map((button) => button.textContent)
    expect(buttons).toEqual(['Reload'])
  })

  it('E6 pressing the action keeps the dialog open with the action busy', async () => {
    await renderDialog()
    const reload = screen.getByRole('button', { name: 'Reload' })

    fireEvent.click(reload)

    expect(reload.getAttribute('aria-busy')).toBe('true')
    expect(screen.getByRole('alertdialog')).toBeTruthy()
  })

  it('E6 closed, nothing renders', () => {
    render(<AlertDialog open={false} title={TITLE} description={DESCRIPTION} actions={null} />)

    expect(screen.queryByRole('alertdialog')).toBeNull()
    expect(screen.queryByText(TITLE)).toBeNull()
  })
})
