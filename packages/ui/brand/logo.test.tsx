import { render, screen } from '@testing-library/react'
import { expect, it } from 'vitest'
import { Logo } from './logo'

it('Logo shows the mark and the name, which carries its meaning', () => {
  const { container } = render(
    <>
      <Logo />
      <Logo />
    </>,
  )

  const marks = container.querySelectorAll('svg')
  const maskIds = [...container.querySelectorAll('mask')].map((mask) => mask.id)

  expect(screen.getAllByText('worKampo')).toHaveLength(2)
  for (const mark of marks) expect(mark.getAttribute('aria-hidden')).toBe('true')
  expect(new Set(maskIds).size).toBe(2)
})
