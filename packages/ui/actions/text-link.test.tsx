import { render, screen } from '@testing-library/react'
import { expect, it } from 'vitest'
import { TextLink } from './text-link'

it('TextLink is a link with the underline style', () => {
  render(<TextLink href="/login">Use another email</TextLink>)

  const link = screen.getByRole('link', { name: 'Use another email' })

  expect(link.getAttribute('href')).toBe('/login')
  expect(link.className).toContain('underline')
})
