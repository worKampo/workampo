import { render, screen } from '@testing-library/react'
import { expect, it } from 'vitest'
import { Card } from './card'

it('Card wraps its content in a surface', () => {
  render(<Card aria-label="Sign in">content</Card>)

  const card = screen.getByLabelText('Sign in')

  expect(card.textContent).toBe('content')
  expect(card.className).toContain('bg-surface')
})
