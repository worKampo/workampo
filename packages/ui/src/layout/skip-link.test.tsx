import { render, screen } from '@testing-library/react'
import { expect, it } from 'vitest'

// A specifier Vite does not resolve ahead, so the file loads before T3 creates the module; turn it
// into a static import when the it.fails marks go.
const MODULE = './skip-link'
const load = () => import(/* @vite-ignore */ MODULE)

it.fails('@id:companies-92-10 SkipLink is a link to the target id, named by its text', async () => {
  const { SkipLink } = await load()

  render(<SkipLink targetId="content">Saltar al contenido</SkipLink>)

  const link = screen.getByRole('link', { name: 'Saltar al contenido' })
  expect(link.getAttribute('href')).toBe('#content')
})
