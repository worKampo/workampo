import assert from 'node:assert/strict'
import { test } from 'node:test'
import { assignIds } from './ids.mjs'

const spec = `Feature: Companies

  @wip(#15)
  Rule: Slug is unique

    @id:companies-15-1
    Example: taken slug
      Given a company

    Example: free slug
      Given nothing

    Scenario: another
      Given x

  @issue(#3)
  Rule: Old rule

    Example: untouched
      Given y

  @wip(#16)
  Rule: Other issue

    Example: first of 16
      Given z
`

test('numbers per issue after the highest existing id', () => {
  const { text, missing } = assignIds(spec, 'companies')
  assert.equal(missing.length, 3)
  assert.match(text, / {4}@id:companies-15-2\n {4}Example: free slug/)
  assert.match(text, / {4}@id:companies-15-3\n {4}Scenario: another/)
  assert.match(text, / {4}@id:companies-16-1\n {4}Example: first of 16/)
  assert.doesNotMatch(text, /@id:[^\n]*\n\s*Example: untouched/)
})

test('appends to an existing tag line', () => {
  const { text } = assignIds('@wip(#1)\nRule: r\n  @slow\n  Example: e\n', 'd')
  assert.match(text, / {2}@slow @id:d-1-1\n {2}Example: e/)
})

test('a second run changes nothing', () => {
  const once = assignIds(spec, 'companies').text
  const again = assignIds(once, 'companies')
  assert.deepEqual(again.missing, [])
  assert.equal(again.text, once)
})
