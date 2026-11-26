import { render, screen } from '@testing-library/react'
import { expect, it } from 'vitest'
import { AppLoader } from './app-loader'

it('@id:companies-92-11 AppLoader is a status named by its label around a decorative 48 px mark', () => {
  render(<AppLoader label="Cargando" />)

  const status = screen.getByRole('status', { name: 'Cargando' })
  const mark = status.querySelector('svg')
  expect(mark?.getAttribute('aria-hidden')).toBe('true')
  expect(mark?.getAttribute('width')).toBe('48')
})
