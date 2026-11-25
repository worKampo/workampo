import { render, screen } from '@testing-library/react'
import { describe, expect, it } from 'vitest'
import { Field } from './field'
import { Input } from './input'

describe('Field', () => {
  it('labels its input and links the help text', () => {
    render(
      <Field label="Email" help="We send you a code">
        {(props) => <Input {...props} />}
      </Field>,
    )

    const input = screen.getByLabelText('Email')

    expect(input.getAttribute('aria-invalid')).toBeNull()
    expect(input.getAttribute('aria-describedby')).toBe(screen.getByText('We send you a code').id)
  })

  it('marks the input invalid and links the error, which replaces the help', () => {
    render(
      <Field label="Code" help="Six digits" error="The code is not valid">
        {(props) => <Input {...props} />}
      </Field>,
    )

    const input = screen.getByLabelText('Code')

    expect(input.getAttribute('aria-invalid')).toBe('true')
    expect(input.getAttribute('aria-describedby')).toBe(
      screen.getByText('The code is not valid').id,
    )
    expect(screen.queryByText('Six digits')).toBeNull()
  })

  it('announces a message that arrives later, such as a live check', () => {
    const field = (help?: string) => (
      <Field label="URL" help={help}>
        {(props) => <Input {...props} />}
      </Field>
    )
    const { container, rerender } = render(field())
    const region = container.querySelector('[aria-live="polite"]')

    expect(region?.textContent).toBe('')
    expect(screen.getByLabelText('URL').getAttribute('aria-describedby')).toBeNull()

    rerender(field('Available'))

    expect(container.querySelector('[aria-live="polite"]')).toBe(region)
    expect(region?.textContent).toBe('Available')
    expect(screen.getByLabelText('URL').getAttribute('aria-describedby')).toBe(region?.id)
  })
})
