import { render, screen } from '@testing-library/react'
import { expect, it } from 'vitest'
import { SkipLink } from './skip-link'

it('@id:companies-92-10 SkipLink is a link to the target id, named by its text', () => {
  render(<SkipLink targetId="content">Saltar al contenido</SkipLink>)

  const link = screen.getByRole('link', { name: 'Saltar al contenido' })
  expect(link.getAttribute('href')).toBe('#content')
})
