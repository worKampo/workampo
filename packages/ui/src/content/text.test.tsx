import { render, screen } from '@testing-library/react'
import { expect, it } from 'vitest'
import { Text } from './text'

it('Text sets size, tone and alignment from the token scale', () => {
  render(
    <Text size="xs" tone="muted" align="center">
      or
    </Text>,
  )

  const text = screen.getByText('or')

  expect(text.tagName).toBe('P')
  expect(text.className).toBe('text-xs text-text-2 text-center')
})
