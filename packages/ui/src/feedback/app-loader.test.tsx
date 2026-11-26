import { render, screen } from '@testing-library/react'
import { expect, it } from 'vitest'

// A specifier Vite does not resolve ahead, so the file loads before T4 creates the module; turn it
// into a static import when the it.fails marks go.
const MODULE = './app-loader'
const load = () => import(/* @vite-ignore */ MODULE)

it.fails('@id:companies-92-11 AppLoader is a status named by its label around a decorative 48 px mark', async () => {
  const { AppLoader } = await load()

  render(<AppLoader label="Cargando" />)

  const status = screen.getByRole('status', { name: 'Cargando' })
  const mark = status.querySelector('svg')
  expect(mark?.getAttribute('aria-hidden')).toBe('true')
  expect(mark?.getAttribute('width')).toBe('48')
})
