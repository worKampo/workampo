import { fireEvent, render, screen, waitFor } from '@testing-library/react'
import { expect, it } from 'vitest'

import { Tooltip } from './tooltip'

async function renderTooltip() {
  render(
    <Tooltip content="Inicio" side="right">
      <button type="button">I</button>
    </Tooltip>,
  )

  return screen.getByRole('button', { name: 'I' })
}

it('@id:companies-92-7 a tooltip stays closed until its trigger is focused', async () => {
  await renderTooltip()

  expect(screen.queryByRole('tooltip')).toBeNull()
})

it('@id:companies-92-7 focusing the trigger shows the tooltip, which describes it, and Esc hides it', async () => {
  const trigger = await renderTooltip()

  fireEvent.focus(trigger)

  const tooltip = await screen.findByRole('tooltip')
  expect(tooltip.textContent).toBe('Inicio')
  expect(trigger.getAttribute('aria-describedby')).toBe(tooltip.id)
  fireEvent.keyDown(document.activeElement ?? trigger, { key: 'Escape' })
  await waitFor(() => expect(screen.queryByRole('tooltip')).toBeNull())
})

it('@id:companies-92-9 a tooltip disabled while open does not come back by itself when enabled again', async () => {
  const tooltip = (disabled: boolean) => (
    <Tooltip content="Northwind Logistics" disabled={disabled}>
      <button type="button">N</button>
    </Tooltip>
  )
  const { rerender } = render(tooltip(false))
  fireEvent.focus(screen.getByRole('button', { name: 'N' }))
  await screen.findByRole('tooltip')

  rerender(tooltip(true))
  await waitFor(() => expect(screen.queryByRole('tooltip')).toBeNull())
  rerender(tooltip(false))

  await new Promise((resolve) => setTimeout(resolve, 400))
  expect(screen.queryByRole('tooltip')).toBeNull()
})

it('forceOpen holds the tooltip open after a click, and it closes when released', async () => {
  const tooltip = (forceOpen: boolean) => (
    <Tooltip content="Copiada" forceOpen={forceOpen}>
      <button type="button">C</button>
    </Tooltip>
  )
  const { rerender } = render(tooltip(true))
  const trigger = screen.getByRole('button', { name: 'C' })

  fireEvent.pointerDown(trigger)
  fireEvent.click(trigger)
  expect((await screen.findByRole('tooltip')).textContent).toBe('Copiada')

  rerender(tooltip(false))
  await waitFor(() => expect(screen.queryByRole('tooltip')).toBeNull())
})

it('a disabled tooltip stays closed even when forced open', async () => {
  render(
    <Tooltip content="Copiada" forceOpen disabled>
      <button type="button">C</button>
    </Tooltip>,
  )

  await new Promise((resolve) => setTimeout(resolve, 50))
  expect(screen.queryByRole('tooltip')).toBeNull()
})
