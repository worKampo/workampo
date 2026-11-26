import { fireEvent, render, screen } from '@testing-library/react'
import { describe, expect, it } from 'vitest'
import { Field } from './field'
import { InputGroup } from './input-group'

function renderUrl(error?: string) {
  render(
    <Field label="URL" error={error}>
      {(control) => <InputGroup prefix="…/c/" {...control} />}
    </Field>,
  )

  return { input: screen.getByRole('textbox', { name: 'URL' }), prefix: screen.getByText('…/c/') }
}

describe('InputGroup', () => {
  it('@id:companies-166-2 puts a decorative left-to-right prefix before the input', () => {
    const { input, prefix } = renderUrl()

    expect(prefix.getAttribute('aria-hidden')).toBe('true')
    expect(prefix.getAttribute('dir')).toBe('ltr')
    expect(prefix.compareDocumentPosition(input) & Node.DOCUMENT_POSITION_FOLLOWING).toBeTruthy()
    expect(input.getAttribute('aria-describedby')).toBeNull()
  })

  it('@id:companies-166-2 clicking the prefix focuses the input', () => {
    const { input, prefix } = renderUrl()

    fireEvent.mouseDown(prefix)
    fireEvent.click(prefix)

    expect(document.activeElement).toBe(input)
  })

  it('@id:companies-166-2 draws the focus ring on the group, and the error border with aria-invalid', () => {
    const { input, prefix } = renderUrl('Not valid')
    const group = prefix.parentElement

    expect(group?.contains(input)).toBe(true)
    expect(input.getAttribute('aria-invalid')).toBe('true')
    expect(group?.className).toMatch(/focus-within:/)
    expect(group?.className).toMatch(/border-neg/)
  })
})
