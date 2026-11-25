import { render, screen } from '@testing-library/react'
import { describe, expect, it } from 'vitest'
import { Form, FormActions } from './form'

describe('Form', () => {
  it('leaves validation to the app', () => {
    render(<Form aria-label="Sign in" />)

    const form = screen.getByRole('form', { name: 'Sign in' })

    expect(form.hasAttribute('novalidate')).toBe(true)
  })

  it('keeps its actions in the order given', () => {
    render(
      <FormActions>
        <a href="/">Cancel</a>
        <button type="submit">Create</button>
      </FormActions>,
    )

    const [cancel, create] = [screen.getByRole('link'), screen.getByRole('button')]

    expect(cancel.compareDocumentPosition(create) & Node.DOCUMENT_POSITION_FOLLOWING).toBeTruthy()
  })
})
