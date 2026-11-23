import { render, screen } from '@testing-library/react'
import { describe, expect, it } from 'vitest'
import { Form } from './form'

describe('Form', () => {
  it('leaves validation to the app', () => {
    render(<Form aria-label="Sign in" />)

    const form = screen.getByRole('form', { name: 'Sign in' })

    expect(form.hasAttribute('novalidate')).toBe(true)
  })
})
