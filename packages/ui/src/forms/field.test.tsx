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

  it('a false or empty error or success leaves the help in place', () => {
    render(
      <Field label="Email" help="We send you a code" error="" success={false}>
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

const urlField = ({
  help,
  success,
  error,
}: {
  help?: string
  success?: string
  error?: string
} = {}) => (
  <Field
    label="URL"
    hint="Lowercase letters, numbers and hyphens"
    help={help}
    success={success}
    error={error}
  >
    {(props) => <Input {...props} />}
  </Field>
)

describe('Field hint and success', () => {
  it('@id:companies-166-2 shows a fixed hint, outside the live region, that the input links', () => {
    const { container } = render(urlField())

    const hint = screen.getByText('Lowercase letters, numbers and hyphens')
    const region = container.querySelector('[aria-live="polite"]')
    expect(hint.closest('[aria-live]')).toBeNull()
    expect(region?.contains(hint)).toBe(false)
    expect(screen.getByLabelText('URL').getAttribute('aria-describedby')).toBe(hint.id)
  })

  it('@id:companies-166-2 keeps the hint when an error arrives, linking the status first', () => {
    render(urlField({ error: 'Not valid' }))

    const hint = screen.getByText('Lowercase letters, numbers and hyphens')
    const error = screen.getByText('Not valid')
    expect(screen.getByLabelText('URL').getAttribute('aria-describedby')).toBe(
      `${error.id} ${hint.id}`,
    )
  })

  it('@id:companies-166-3 shows success in the positive colour with a decorative check', () => {
    const { container } = render(urlField({ success: 'Available' }))

    const region = container.querySelector('[aria-live="polite"]')
    expect(region?.textContent).toBe('Available')
    expect(screen.getByText('Available').closest('[class*="text-pos"]')).not.toBeNull()
    expect(region?.querySelector('svg')?.getAttribute('aria-hidden')).toBe('true')
    expect(screen.getByLabelText('URL').getAttribute('aria-invalid')).toBeNull()
  })

  it('@id:companies-166-3 the status shows the error over success, and success over help', () => {
    const { container, rerender } = render(
      urlField({ help: 'Checking', success: 'Available', error: 'Not valid' }),
    )
    const region = () => container.querySelector('[aria-live="polite"]')?.textContent

    expect(region()).toBe('Not valid')
    rerender(urlField({ help: 'Checking', success: 'Available' }))
    expect(region()).toBe('Available')
    rerender(urlField({ help: 'Checking' }))
    expect(region()).toBe('Checking')
  })
})
