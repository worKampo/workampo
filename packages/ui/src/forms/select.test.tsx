import { fireEvent, render, screen } from '@testing-library/react'
import { describe, expect, it, vi } from 'vitest'
import { Field } from './field'
import { Select } from './select'

const options = [
  <option key="es" value="es">
    Español
  </option>,
  <option key="en" value="en">
    English
  </option>,
]

describe('Select', () => {
  it('is named by the label of its field and lists its options', () => {
    render(<Field label="Language">{(control) => <Select {...control}>{options}</Select>}</Field>)

    const select = screen.getByRole('combobox', { name: 'Language' })

    expect(screen.getAllByRole('option').map((option) => option.textContent)).toEqual([
      'Español',
      'English',
    ])
    expect(select).toBeTruthy()
  })

  it('reports the chosen value', () => {
    const onChange = vi.fn()
    render(
      <Select aria-label="Language" defaultValue="es" onChange={onChange}>
        {options}
      </Select>,
    )

    const select = screen.getByRole('combobox', { name: 'Language' }) as HTMLSelectElement
    fireEvent.change(select, { target: { value: 'en' } })

    expect(select.value).toBe('en')
    expect(onChange).toHaveBeenCalledTimes(1)
  })

  it('in error is invalid and described by the message', () => {
    render(
      <Field label="Language" error="Pick a language">
        {(control) => <Select {...control}>{options}</Select>}
      </Field>,
    )

    const select = screen.getByRole('combobox', { name: 'Language' })

    expect(select.getAttribute('aria-invalid')).toBe('true')
    expect(select.getAttribute('aria-describedby')).toBe(screen.getByText('Pick a language').id)
    expect(select.className).toContain('aria-invalid:border-neg')
  })
})
