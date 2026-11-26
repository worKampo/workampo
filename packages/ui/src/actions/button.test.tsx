import { render, screen } from '@testing-library/react'
import { describe, expect, it } from 'vitest'
import { Button, buttonClassName } from './button'

describe('Button', () => {
  it('is a plain button by default, so it never submits a form by accident', () => {
    render(<Button>Continue</Button>)

    const button = screen.getByRole('button', { name: 'Continue' })

    expect(button.getAttribute('type')).toBe('button')
    expect(button.className).toContain('bg-ui')
  })

  it('takes the type, variant and extra classes it is given', () => {
    render(
      <Button type="submit" variant="secondary" className="w-full">
        Send
      </Button>,
    )

    const button = screen.getByRole('button', { name: 'Send' })

    expect(button.getAttribute('type')).toBe('submit')
    expect(button.className).toContain('border-border-hard')
    expect(button.className).toContain('w-full')
  })

  it('styles a link that navigates like a button', () => {
    render(
      <a href="/api/sessions/google" className={buttonClassName({ variant: 'secondary' })}>
        Continue with Google
      </a>,
    )

    const link = screen.getByRole('link', { name: 'Continue with Google' })

    expect(link.className).toContain('border-border-hard')
  })
})

// Loaded untyped, so `variant="subtle"` typechecks before T4 adds it; turn it into the static
// import above when the it.fails mark goes.
const BUTTON = './button'
const loadButton = () => import(/* @vite-ignore */ BUTTON)

it.fails('the subtle variant has no border until hover, and a soft one on touch (ticket 93, decision 8)', async () => {
  const { Button: Untyped } = await loadButton()
  render(<Untyped variant="subtle">Copy</Untyped>)

  const button = screen.getByRole('button', { name: 'Copy' })

  expect(button.className).toContain('border-transparent')
  expect(button.className).toContain('hover:border-border-hard')
  expect(button.className).toContain('hover:text-text')
  expect(button.className).toContain('pointer-coarse:border-border')
  expect(button.className).not.toContain('bg-ui')
})
