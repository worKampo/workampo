import { render } from '@testing-library/react'
import { expect, it } from 'vitest'

// A specifier Vite does not resolve ahead, so the file loads before T4 creates the module; turn it
// into a static import when the it.fails marks go.
const MODULE = './logo-mark'
const load = () => import(/* @vite-ignore */ MODULE)

it.fails('@id:companies-92-11 LogoMark is a decorative mark of the size asked, unique in the page', async () => {
  const { LogoMark } = await load()

  const { container } = render(
    <>
      <LogoMark size={48} />
      <LogoMark size={32} />
    </>,
  )

  const [large, small] = container.querySelectorAll('svg')
  const maskIds = [...container.querySelectorAll('[id]')].map((element) => element.id)
  expect(large?.getAttribute('aria-hidden')).toBe('true')
  expect(large?.getAttribute('width')).toBe('48')
  expect(small?.getAttribute('width')).toBe('32')
  expect(container.textContent).toBe('')
  expect(new Set(maskIds).size).toBe(maskIds.length)
})
