import { fireEvent, render, screen, waitFor } from '@testing-library/react'
import { expect, it } from 'vitest'

// A specifier Vite does not resolve ahead, so the file loads before T2 creates the module; turn it
// into a static import when the it.fails marks go.
const MODULE = './tooltip'
const load = () => import(/* @vite-ignore */ MODULE)

async function renderTooltip() {
  const { Tooltip } = await load()
  render(
    <Tooltip content="Inicio" side="right">
      <button type="button">I</button>
    </Tooltip>,
  )

  return screen.getByRole('button', { name: 'I' })
}

it.fails('@id:companies-92-7 a tooltip stays closed until its trigger is focused', async () => {
  await renderTooltip()

  expect(screen.queryByRole('tooltip')).toBeNull()
})

it.fails('@id:companies-92-7 focusing the trigger shows the tooltip, which describes it, and Esc hides it', async () => {
  const trigger = await renderTooltip()

  fireEvent.focus(trigger)

  const tooltip = await screen.findByRole('tooltip')
  expect(tooltip.textContent).toBe('Inicio')
  expect(trigger.getAttribute('aria-describedby')).toBe(tooltip.id)
  fireEvent.keyDown(document.activeElement ?? trigger, { key: 'Escape' })
  await waitFor(() => expect(screen.queryByRole('tooltip')).toBeNull())
})
