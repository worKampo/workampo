import { render, screen } from '@testing-library/react'
import { describe, expect, it } from 'vitest'
import { Form, FormActions } from './form'

describe('Form', () => {
  it('leaves validation to the app', () => {
    render(<Form aria-label="Sign in" />)

    const form = screen.getByRole('form', { name: 'Sign in' })

    expect(form.hasAttribute('novalidate')).toBe(true)
  })

  it('puts the focus on its first field, skipping hidden, unrendered and disabled ones', () => {
    render(
      <Form aria-label="Create">
        <input type="hidden" name="token" />
        <input aria-label="Locked" disabled />
        <input aria-label="Not rendered" hidden />
        <div hidden>
          <input aria-label="In a hidden section" />
        </div>
        <input aria-label="Name" />
        <input aria-label="Slug" />
      </Form>,
    )

    expect(document.activeElement).toBe(screen.getByRole('textbox', { name: 'Name' }))
  })

  it('leaves the focus alone when it is not the page task', () => {
    render(
      <Form aria-label="Filters" focusFirstField={false}>
        <input aria-label="Search" />
      </Form>,
    )

    expect(document.activeElement).toBe(document.body)
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
