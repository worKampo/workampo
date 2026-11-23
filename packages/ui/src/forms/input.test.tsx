import { render, screen } from '@testing-library/react'
import { describe, expect, it } from 'vitest'
import { Field } from './field'
import { Input } from './input'

describe('Input', () => {
  it('is named by the label of its field', () => {
    render(<Field label="Email">{(control) => <Input {...control} />}</Field>)

    const input = screen.getByRole('textbox', { name: 'Email' })

    expect(input).toBeTruthy()
  })

  it('in error is invalid and described by the message', () => {
    render(
      <Field label="Code" error="The code is not valid">
        {(control) => <Input {...control} />}
      </Field>,
    )

    const input = screen.getByRole('textbox', { name: 'Code' })

    expect(input.getAttribute('aria-invalid')).toBe('true')
    expect(input.getAttribute('aria-describedby')).toBe(
      screen.getByText('The code is not valid').id,
    )
    expect(input.className).toContain('aria-invalid:border-neg')
  })

  it('can be disabled', () => {
    render(<Input aria-label="Email" disabled />)

    const input = screen.getByRole('textbox', { name: 'Email' }) as HTMLInputElement

    expect(input.disabled).toBe(true)
    expect(input.className).toContain('disabled:bg-muted')
  })
})
